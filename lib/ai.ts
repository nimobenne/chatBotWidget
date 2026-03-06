import OpenAI from 'openai';
import { z } from 'zod';
import { getStore } from './store';
import { getAvailableSlots, createBookingRecord } from './booking';
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

If booking is disabled or booking fails after retries, say "Online booking is not available right now. Please call ${business.contact.phone} to book."

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
            required: ['serviceName', 'dateTime', 'customerName', 'customerEmail']
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

    const parseArgs = (raw: string) => {
      try {
        return JSON.parse(raw || '{}') as Record<string, any>;
      } catch {
        return {};
      }
    };

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'get_available_slots') {
          const args = parseArgs(toolCall.function.arguments);
          let dateStr = String(args.date || '');
          
          const lower = dateStr.toLowerCase();
          if (lower.includes('tomorrow')) {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            dateStr = t.toISOString().split('T')[0];
          } else if (lower.includes('today')) {
            dateStr = new Date().toISOString().split('T')[0];
          }

          const serviceName = String(args.serviceName || '').trim() || business.services[0]?.name;
          if (!serviceName) {
            assistantText = 'Please tell me which service you want to book.';
            continue;
          }

          const slots = await getAvailableSlots(business, serviceName, {
            start: `${dateStr}T00:00:00`,
            end: `${dateStr}T23:59:59`
          });

          if (slots.length === 0) {
            assistantText = `Sorry, there are no available times for ${serviceName} on ${dateStr}. Would you like to try a different date?`;
          } else {
            const list = slots.slice(0, 6).map(s => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).join(', ');
            assistantText = `Available times for ${serviceName} on ${dateStr}: ${list}. Which time works for you?`;
          }
        }

        if (toolCall.function.name === 'create_booking') {
          const args = parseArgs(toolCall.function.arguments);
          let dt = args.dateTime;

          const serviceName = String(args.serviceName || '').trim();
          const customerName = String(args.customerName || '').trim();
          const customerEmail = String(args.customerEmail || '').trim();
          if (!serviceName || !dt || !customerName || !customerEmail) {
            assistantText = 'I can book that right away. Please provide service, date/time, your full name, and email.';
            continue;
          }
          
          if (typeof dt === 'string' && dt.toLowerCase().includes('tomorrow')) {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            const time = dt.match(/(\d{1,2}:\d{2})/)?.[1] || '15:00';
            dt = `${t.toISOString().split('T')[0]}T${time}:00`;
          }

          const parsedDt = new Date(dt);
          if (Number.isNaN(parsedDt.getTime())) {
            assistantText = `I couldn't understand that date/time. Please share it like "tomorrow 3:00 PM".`;
            continue;
          }

          try {
            const booking = await createBookingRecord({
              business,
              serviceName,
              startTimeISO: parsedDt.toISOString(),
              customerName,
              customerPhone: args.customerPhone,
              customerEmail,
              status: 'confirmed'
            });
            await sendBookingConfirmation({
              to: customerEmail,
              customerName,
              serviceName,
              dateTime: dt,
              businessName: business.name,
              businessAddress: business.contact.address,
              businessPhone: business.contact.phone
            }).catch(() => {});

            const fmt = new Date(dt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            assistantText = `✅ Booked! ${customerName} - ${serviceName} on ${fmt}. Confirmation sent to ${customerEmail}`;
          } catch (err) {
            assistantText = `Sorry, that time isn't available. Try another time, or call ${business.contact.phone} and we can book by phone.`;
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
