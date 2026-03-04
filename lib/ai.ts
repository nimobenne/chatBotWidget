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

function getSystemPrompt(businessName: string, bookingEnabled: boolean, services: { name: string; durationMin: number; priceRange?: string }[], phone: string) {
  const serviceList = services.map(s => `- ${s.name} (${s.durationMin} min${s.priceRange ? ` - ${s.priceRange}` : ''})`).join('\n');
  const serviceAliases = services.map(s => {
    const lower = s.name.toLowerCase();
    if (lower.includes('classic haircut')) return `${s.name}: haircut, cut, hair`;
    if (lower.includes('skin fade')) return `${s.name}: fade, skin fade`;
    if (lower.includes('beard trim')) return `${s.name}: beard, trim`;
    return `${s.name}: ${lower}`;
  }).join('\n');
  
  return `You are ${businessName}'s receptionist. Help customers book appointments.

SERVICES:
${serviceList}

SERVICE ALIASES (map these to actual services):
${serviceAliases}

HOW TO BOOK (follow exactly):

1. If customer wants to book, FIRST ask: "What service would you like?" - wait for answer
2. Then ask: "What date and time works for you?" - wait for answer  
3. Call get_available_slots function with their service and date
4. Tell them the available times
5. Ask: "What time works best?" - wait for answer
6. Ask: "What's your name and email to confirm?" - wait for answer
7. Call create_booking function with all info
8. Say: "Your booking is confirmed! Check your email for details."

RULES:
- Map "haircut" to "Classic Haircut", "fade" to "Skin Fade", "beard" to "Beard Trim"
- Ask ONE question at a time. Wait for answer before next step.
- If online booking is disabled, say: "I'm sorry, please call ${phone} to book."
- Do NOT call create_booking until you have: service + date/time + name + email
- Do NOT ask for name/email before checking availability
- Keep responses short (1-2 sentences)`;
}

export async function runAssistant(input: { businessId: string; sessionId: string; message: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

  const store = getStore();
  const business = await store.getBusinessConfig(input.businessId);
  if (!business) throw new Error('Unknown businessId.');

  const client = new OpenAI({ apiKey });
  const bookingEnabled = business.bookingMode !== null && business.bookingMode !== 'request';

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'get_available_slots',
        description: 'Check available times for a service on a date',
        parameters: {
          type: 'object',
          properties: {
            serviceName: { type: 'string', description: 'Service name like "Classic Haircut"' },
            date: { type: 'string', description: 'Date like "2026-03-05" or "tomorrow"' }
          },
          required: ['serviceName', 'date']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_booking',
        description: 'Book an appointment - only call when you have ALL info',
        parameters: {
          type: 'object',
          properties: {
            serviceName: { type: 'string' },
            dateTime: { type: 'string', description: 'ISO format like "2026-03-05T15:00:00"' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            customerEmail: { type: 'string' }
          },
          required: ['serviceName', 'dateTime', 'customerName', 'customerPhone', 'customerEmail']
        }
      }
    }
  ];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      tools: bookingEnabled ? tools : undefined,
      messages: [
        { role: 'system', content: getSystemPrompt(business.name, bookingEnabled, business.services, business.contact.phone) },
        { role: 'user', content: input.message }
      ]
    });

    let assistantText = '';
    const message = response.choices[0]?.message;

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'get_available_slots') {
          const args = JSON.parse(toolCall.function.arguments);
          let dateStr = args.date || '';
          
          const lowerDate = dateStr.toLowerCase();
          if (lowerDate.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateStr = tomorrow.toISOString().split('T')[0];
          } else if (lowerDate.includes('today')) {
            dateStr = new Date().toISOString().split('T')[0];
          }

          const slots = await getAvailableSlots(business, args.serviceName, {
            start: `${dateStr}T00:00:00`,
            end: `${dateStr}T23:59:59`
          });

          const slotsText = slots.length > 0 
            ? slots.slice(0, 8).map(s => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).join(', ')
            : 'No times available';

          assistantText = `Here are available times for ${args.serviceName} on ${dateStr}: ${slotsText}\n\nWhat time works best?`;
        }

        if (toolCall.function.name === 'create_booking') {
          const args = JSON.parse(toolCall.function.arguments);
          let dateTime = args.dateTime;
          
          const lowerDt = dateTime.toLowerCase();
          if (lowerDt.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const timeMatch = dateTime.match(/(\d{1,2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : '15:00';
            dateTime = `${tomorrow.toISOString().split('T')[0]}T${time}:00`;
          }

          try {
            const booking = await createBookingRecord({
              business,
              serviceName: args.serviceName,
              startTimeISO: new Date(dateTime).toISOString(),
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
              dateTime: dateTime,
              businessName: business.name,
              businessAddress: business.contact.address,
              businessPhone: business.contact.phone
            }).catch(() => {});

            const formatted = new Date(dateTime).toLocaleDateString('en-US', { 
              weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' 
            });

            assistantText = `✅ Booking confirmed for ${args.customerName}!\n📅 ${formatted}\n📧 Confirmation sent to ${args.customerEmail}\n\nSee you then!`;
          } catch (err) {
            assistantText = `❌ Sorry, that time is no longer available. What other time works?`;
          }
        }
      }
    }

    if (!assistantText) {
      assistantText = message?.content || 'How can I help you today?';
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
    throw new Error(`AI error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}
