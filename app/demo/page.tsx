import DemoClient from './DemoClient';

export default function DemoPage({ searchParams }: { searchParams: { biz?: string } }) {
  return <DemoClient initialBiz={searchParams.biz || 'demo_barber'} />;
}
