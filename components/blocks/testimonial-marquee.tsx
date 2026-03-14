import { Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

type Testimonial = {
  quote: string;
  name: string;
  shop: string;
};

const testimonials: Testimonial[] = [
  {
    quote: 'We book clients while we are cutting. Fewer missed calls, fuller afternoons.',
    name: 'Youssef',
    shop: 'Fade District'
  },
  {
    quote: 'The live availability is the real deal. No double booking headaches anymore.',
    name: 'Marco',
    shop: 'Studio Blend'
  },
  {
    quote: 'After-hours bookings jumped in the first week. It pays for itself fast.',
    name: 'Sergio',
    shop: 'Clip Theory'
  },
  {
    quote: 'Our team finally stopped answering repetitive booking messages all day.',
    name: 'Imran',
    shop: 'Northline Barbers'
  }
];

function TestimonialCard({ quote, name, shop }: Testimonial) {
  return (
    <article
      aria-label={`Testimonial from ${name}, ${shop}`}
      className="w-[280px] shrink-0 rounded-xl border border-border/80 bg-card/80 p-4 backdrop-blur transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-amber-500/30"
    >
      <div className="mb-3 flex items-center gap-1 text-amber-300">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="h-3.5 w-3.5 fill-current" />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-card-foreground/90">"{quote}"</p>
      <div className="mt-4 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground">{name}</div>
        <div>{shop}</div>
      </div>
    </article>
  );
}

export function TestimonialMarquee() {
  const items = [...testimonials, ...testimonials];

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Trusted by barbers</p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">What owners say after going live</h3>
        </div>
        <Badge variant="secondary" className="border-amber-500/50 bg-amber-500/15 text-amber-100">
          4.9 average
        </Badge>
      </div>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max gap-4 py-1 motion-safe:animate-marquee motion-reduce:translate-x-0 motion-reduce:animate-none hover:[animation-play-state:paused]">
          {items.map((item, index) => (
            <TestimonialCard key={`${item.name}-${index}`} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
