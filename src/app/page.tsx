import { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';

export default function Home() {
  return <AppLayout />;
}

export const metadata: Metadata = {
  title: 'kotobalint',
  description: 'AIを活用した日本語テキスト校正・修正ツール。文法・スタイル・一貫性の問題を検出・修正します。',
}



