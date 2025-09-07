import { Metadata } from 'next'

// Components
function HeroSection() {
  return (
    <section className="text-center mb-12">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 jp-text">
        Japanese Proofreading App
      </h1>
      <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
        AIを活用した日本語テキスト校正・修正ツール
        <br />
        文法・スタイル・一貫性の問題を検出・修正します
      </p>
    </section>
  )
}

function FeatureCard({
  title,
  description,
  icon
}: {
  title: string
  description: string
  icon: string
}) {
  return (
    <div className="card card-hover animate-fade-in">
      <div className="text-center">
        <div className="text-4xl mb-4" aria-hidden="true">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}

function FeaturesSection() {
  const features = [
    {
      title: 'ルールベース検出',
      description: '文法エラー、表記ゆれ、冗長表現など、確実なルールに基づいた問題検出を行います。',
      icon: '🔍'
    },
    {
      title: 'AI支援提案',
      description: '最新のAI技術を活用し、文脈を理解した読みやすさやスタイルの改善提案を提供します。',
      icon: '🤖'
    },
    {
      title: '高速処理',
      description: '2000文字を5秒以内で解析し、即座に修正提案を表示します。',
      icon: '⚡'
    },
    {
      title: 'プライバシー重視',
      description: 'すべての処理をローカルで行い、テキストデータを外部に送信しません。',
      icon: '🔒'
    }
  ]

  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-8">
        主な機能
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
          />
        ))}
      </div>
    </section>
  )
}

function StatusCard() {
  return (
    <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          プロジェクトセットアップ完了
        </h3>

        <p className="text-gray-600 mb-4">
          フェーズ1の基盤構築が完了しました
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <span className="status-indicator status-success">
            Next.js 14
          </span>
          <span className="status-indicator status-success">
            TypeScript 5
          </span>
          <span className="status-indicator status-success">
            Tailwind CSS 3.3
          </span>
        </div>

        <p className="text-sm text-gray-500">
          次フェーズ: YAMLルールパーサー・基本ルールエンジン開発
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-gray-50"
      role="main"
      aria-labelledby="main-heading"
    >
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-6xl mx-auto">
          <HeroSection />
          <FeaturesSection />
          <StatusCard />
        </div>
      </div>
    </main>
  )
}

export const metadata: Metadata = {
  title: 'ホーム',
  description: 'Japanese Proofreading Appのホーム画面。AIを活用した日本語テキスト校正・修正ツールです。',
}



