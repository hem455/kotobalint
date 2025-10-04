import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * スケルトンローディングコンポーネント
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height
}) => {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

/**
 * テキスト行スケルトン
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
};

/**
 * Issue リストアイテムスケルトン
 */
export const SkeletonIssueItem: React.FC = () => {
  return (
    <div className="px-2 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton height={20} width="80%" />
          <Skeleton height={14} width="40%" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton height={24} width={60} className="rounded-full" />
          <Skeleton height={24} width={50} className="rounded-md" />
        </div>
      </div>
    </div>
  );
};

/**
 * Issue リストスケルトン
 */
export const SkeletonIssueList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonIssueItem key={i} />
      ))}
    </div>
  );
};
