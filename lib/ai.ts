import OpenAI from 'openai';
import { z } from 'zod';
import { createHandoffAndAlert, sendBookingConfirmationEmail } from './alerts';
import { calculateBookingTimes, createBookingRecord, getAvailableSlots } from './booking';
import { createGoogleCalendarEvent } from './google';
import { BusinessRow, getSupabaseStore } from './store.supabase';

const inputSchema = z.object({
  businessId: z.string().optional(),
  sessionId: z.string().min(1),
  message: z.string().min(1).max(1000)
});

export function validateChatInput(payload: unknown) {
  return inputSchema.parse(payload);
}

function getBusinessSlug(inputBusinessId?: string): string {
  if (inputBusinessId) return inputBusinessId;
  if (process.env.NODE_ENV !== 'production') return 'demo_barber';
  throw new Error('Widget misconfigured: businessId missing');
}

function sanitizeBusinessInfo(business: BusinessRow) {
  return {
    name: business.name,
    timezone: business.timezone,
    hours: business.hours,
    services: business.services,
    policies: business.policies,
    phone: business.contact_phone,
    address: business.address,
    faq: business.faq,
    bookingMode: business.booking_mode
  };
}

function buildSystemPrompt(business: BusinessRow) {
  return `You are a friendly AI receptionist for ${business.name}.
Rules:
- Never ask which business this is; it is already selected.
- Start in normal conversational mode: answer questions naturally without forcing a booking flow.
- Only switch to booking flow when the user clearly asks to book/reschedule/cancel.
- In booking flow, collect only service, date/time, customer name and customer email.
- Never ask for a phone number.
- Before confirming a booking, read back the email address and ask for explicit confirmation.
- Call createBooking only after the user confirms the email is correct.
- Use tools for availability, booking, and handoff.
- Only confirm a booking after createBooking succeeds.
- If unsure or unable to fulfill, use handoffToOwner.
- Keep replies concise and helpful.`;
}

export async function runAssistant(input: { businessId?: string; sessionId: string; message: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

  const store = getSupabaseStore();
  const slug = getBusinessSlug(input.businessId);
  const business = await store.getBusinessBySlug(slug);
  if (!business) throw new Error('This chat widget is not configured. Please contact the business.');

  const history = await store.getConversationMessages(business.id, input.sessionId);
  const recentHistory = history.slice(-12);

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const tools: OpenAI.Responses.Tool[] = [
    {
      type: 'function',
      name: 'getBusinessInfo',
      description: 'Get business hours, services, policy and contact basics',
      strict: true,
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    },
    {
      type: 'function',
      name: 'getAvailableSlots',
      description: 'Find available slots for a service',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string' },
          dateRangeISO: {
            type: 'object',
            properties: { start: { type: 'string' }, end: { type: 'string' } },
            required: ['start', 'end'],
            additionalProperties: false
          }
        },
        required: ['serviceName', 'dateRangeISO'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'createBooking',
      description: 'Create a confirmed booking after customer confirms their email address',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string' },
          startTimeISO: { type: 'string' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string' },
          emailConfirmed: { type: 'boolean' }
        },
        required: ['serviceName', 'startTimeISO', 'customerName', 'customerEmail', 'emailConfirmed'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'requestBooking',
      description: 'Create a booking request for manual follow-up',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          preferredDateRangeISO: {
            type: 'object',
            properties: { start: { type: 'string' }, end: { type: 'string' } },
            required: ['start', 'end'],
            additionalProperties: false
          },
          serviceName: { type: 'string' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['preferredDateRangeISO', 'serviceName', 'customerName', 'customerEmail', 'notes'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'handoffToOwner',
      description: 'Escalate to owner with summary and contact',
      strict: true,
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' }, customerContact: { type: 'string' } },
        required: ['summary', 'customerContact'],
        additionalProperties: false
      }
    }
  ];

  const response = await client.responses.create({
    model,
    tools,
    input: [
      { role: 'system', content: buildSystemPrompt(business) },
      { role: 'system', content: `Business context: ${JSON.stringify(sanitizeBusinessInfo(business))}` },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: input.message }
    ]
  });

  let current = response;
  for (let i = 0; i < 4; i += 1) {
    const calls = current.output.filter((item) => item.type === 'function_call');
    if (!calls.length) break;

    const toolOutputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = [];

    for (const call of calls) {
      const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
      try {
        let result: unknown;
        if (call.name === 'getBusinessInfo') {
          result = sanitizeBusinessInfo(business);
        } else if (call.name === 'getAvailableSlots') {
          result = await getAvailableSlots(
            business,
            String(args.serviceName || ''),
            (args.dateRangeISO || { start: new Date().toISOString(), end: new Date().toISOString() }) as { start: string; end: string }
          );
        } else if (call.name === 'createBooking') {
          if (args.emailConfirmed !== true) {
            result = {
              error: 'email_not_confirmed',
              message: `Please confirm this email first: ${String(args.customerEmail || '')}`
            };
          } else {
            try {
              const serviceName = String(args.serviceName || '');
              const startTimeISO = String(args.startTimeISO || '');
              const customerName = String(args.customerName || '');
              const customerEmail = String(args.customerEmail || '');

              const times = calculateBookingTimes({ business, serviceName, startTimeISO });
              const eventId = await createGoogleCalendarEvent({
                businessId: business.id,
                summary: `${serviceName} - ${customerName}`,
                description: `Email: ${customerEmail}`,
                startISO: times.startISO,
                endISO: times.endISO,
                timezone: business.timezone
              });

              const booking = await createBookingRecord({
                business,
                serviceName,
                startTimeISO,
                customerName,
                customerEmail,
                customerPhone: 'not_provided',
                status: 'confirmed',
                calendarEventId: eventId
              });

              await sendBookingConfirmationEmail({
                business,
                customerName,
                customerEmail,
                serviceName,
                startTimeISO: booking.start_time,
                bookingId: booking.id
              });

              result = { bookingId: booking.id, confirmedTime: booking.start_time, calendarEventId: eventId ?? null };
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown booking error';
              if (message.toLowerCase().includes('overlap') || message.toLowerCase().includes('conflict')) {
                result = { error: 'slot_taken', message: 'That slot is no longer available. Please choose another option.' };
              } else {
                result = { error: 'booking_failed', message };
              }
            }
          }
        } else if (call.name === 'requestBooking') {
          const booking = await createBookingRecord({
            business,
            serviceName: String(args.serviceName || ''),
            startTimeISO: String((args.preferredDateRangeISO as { start?: string } | undefined)?.start || ''),
            customerName: String(args.customerName || ''),
            customerEmail: args.customerEmail ? String(args.customerEmail) : undefined,
            customerPhone: 'not_provided',
            status: 'requested',
            notes: args.notes ? String(args.notes) : undefined
          });
          result = { requestId: booking.id, status: 'requested' };
        } else if (call.name === 'handoffToOwner') {
          const handoff = await createHandoffAndAlert({
            business,
            summary: String(args.summary || ''),
            lastUserMessage: input.message,
            customerContact: String(args.customerContact || '')
          });
          result = { status: 'handoff_created', emailed: handoff.emailed };
        } else {
          result = { error: 'unknown_tool' };
        }

        toolOutputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
      } catch (error) {
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' })
        });
      }
    }

    current = await client.responses.create({ model, previous_response_id: current.id, input: toolOutputs });
  }

  const assistantText = current.output_text || 'Sorry, I could not process that request.';

  await store.upsertConversation({
    business_id: business.id,
    session_id: input.sessionId,
    newMessages: [
      { role: 'user', content: input.message, at: new Date().toISOString() },
      { role: 'assistant', content: assistantText, at: new Date().toISOString() }
    ],
    last_user: input.message,
    last_assistant: assistantText
  });

  return { message: assistantText, businessSlug: business.slug };
}
