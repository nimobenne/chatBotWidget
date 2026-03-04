import OpenAI from 'openai';
import { z } from 'zod';
import { getStore } from './store';
import { getAvailableSlots, createBookingRecord } from './booking';
import { createCalendarEvent } from './calendar';
import { sendBookingConfirmation } from './email';

const inputSchema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1).max(1000)
});

export function validateChatInput(payload: unknown) {
  return inputSchema.parse(payload);
}

function getSystemPrompt(business: { name: string; services: { name: string; durationMin: number; priceRange?: string }[]; contact: { phone: string; address?: string }; hours: Record<string, { open: string; close: string } | null>; bookingMode: string }) {
  const services = business.services.map(s => `- ${s.name}: ${s.durationMin} min${s.priceRange ? ` (${s.priceRange})` : ''}`).join('\n');
  
  return `You are a friendly receptionist for ${business.name}.

BUSINESS INFO:
- Services:
${services}
- Phone: ${business.contact.phone}
- Address: ${business.contact.address || 'N/A'}
- Hours: ${JSON.stringify(business.hours)}

BOOKING IS ${business.bookingMode === 'calendar' ? 'ENABLED' : 'DISABLED'}.

IMPORTANT: Remember what the customer tells you during this conversation. Don't ask for the same info twice.

When customers want to book:
1. Ask what service they want (if they haven't said)
2. Ask what date/time works (if they haven't said)
3. Get their name and email (if they haven't given)
4. Then book it

If booking is disabled, say "Online booking is not available. Please call ${business.contact.phone} to book."

Keep responses short and friendly.`;
}

export async function runAssistant(input: { businessId: string; sessionId: string; message: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

  const store = getStore();
  const business = await store.getBusinessConfig(input.businessId);
  if (!business) throw new Error('Unknown businessId.');

  const client = new OpenAI({ apiKey });

  const tools = business.bookingMode === 'calendar' ? [
    {
      type: 'function' as const,
      function: {
        name: 'get_available_slots',
        description: 'Check available appointment times',
        parameters: {
          type: 'object',
          properties: {
            serviceName: { type: 'string' },
            date: { type: 'string' }
          },
          required: ['serviceName', 'date']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_booking',
        description: 'Book an appointment',
        parameters: {
          type: 'object',
          properties: {
            serviceName: { type: 'string' },
            dateTime: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            customerEmail: { type: 'string' }
          },
          required: ['serviceName', 'dateTime', 'customerName', 'customerPhone', 'customerEmail']
        }
      }
    }
  ] : [];

  try {
    // Get conversation history
    const history = await store.getConversationHistory(input.businessId, input.sessionId, 8);
    
    const historyText = history.length > 0 
      ? history.map(h => `User: ${h.userMessage}\nAssistant: ${h.assistantMessage}`).join('\n\n')
      : '';

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      tools,
      messages: [
        { role: 'system' as const, content: getSystemPrompt(business) },
        ...(historyText ? [{ role: 'user' as const, content: `Previous conversation:\n${historyText}` }] : []),
        { role: 'user' as const, content: input.message }
      ]
    });

    let assistantText = '';
    const message = response.choices[0]?.message;

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'get_available_slots') {
          const args = JSON.parse(toolCall.function.arguments);
          let dateStr = args.date || '';
          
          const lower = dateStr.toLowerCase();
          if (lower.includes('tomorrow')) {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            dateStr = t.toISOString().split('T')[0];
          } else if (lower.includes('today')) {
            dateStr = new Date().toISOString().split('T')[0];
          }

          const slots = await getAvailableSlots(business, args.serviceName, {
            start: `${dateStr}T00:00:00`,
            end: `${dateStr}T23:59:59`
          });

          const list = slots.length > 0 
            ? slots.slice(0, 6).map(s => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).join(', ')
            : 'No availability';

          assistantText = `Available times for ${args.serviceName} on ${dateStr}: ${list}`;
        }

        if (toolCall.function.name === 'create_booking') {
          const args = JSON.parse(toolCall.function.arguments);
          let dt = args.dateTime;
          
          if (dt.toLowerCase().includes('tomorrow')) {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            const time = dt.match(/(\d{1,2}:\d{2})/)?.[1] || '15:00';
            dt = `${t.toISOString().split('T')[0]}T${time}:00`;
          }

          try {
            const booking = await createBookingRecord({
              business,
              serviceName: args.serviceName,
              startTimeISO: new Date(dt).toISOString(),
              customerName: args.customerName,
              customerPhone: args.customerPhone,
              customerEmail: args.customerEmail,
              status: 'confirmed'
            });

            await createCalendarEvent(booking, business).catch(() => {});
            await sendBookingConfirmation({
              to: args.customerEmail,
              customerName: args.customerName,
              serviceName: args.serviceName,
              dateTime: dt,
              businessName: business.name,
              businessAddress: business.contact.address,
              businessPhone: business.contact.phone
            }).catch(() => {});

            const fmt = new Date(dt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            assistantText = `✅ Booked! ${args.customerName} - ${args.serviceName} on ${fmt}. Confirmation sent to ${args.customerEmail}`;
          } catch (err) {
            assistantText = `Sorry, that time isn't available. Try another time.`;
          }
        }
      }
    }

    if (!assistantText) {
      assistantText = message?.content || 'How can I help?';
    }

    await store.logConversation({
      businessId: input.businessId,
      sessionId: input.sessionId,
      userMessage: input.message,
      assistantMessage: assistantText,
      createdAt: new Date().toISOString()
    });

    return { message: assistantText };
  } catch (err) {
    throw new Error(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}
