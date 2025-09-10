import { NextRequest, NextResponse } from 'next/server';
import { observabilityManager } from '@/lib/observability';
import type { ApiResponse } from '@/types';

/**
 * GET /api/metrics - メトリクスと監査ログの取得
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{
  metrics: any;
  auditLogs: any[];
  healthStatus: any;
}>>> {
  try {
    const url = new URL(request.url);
    const event = url.searchParams.get('event');
    const limit = url.searchParams.get('limit');
    
    // メトリクスを取得
    const metrics = observabilityManager.getMetrics();
    
    // 監査ログを取得
    const auditLogs = event 
      ? observabilityManager.getAuditLogsByEvent(event, limit ? parseInt(limit) : undefined)
      : observabilityManager.getAuditLogs(limit ? parseInt(limit) : undefined);
    
    // ヘルスステータスを取得
    const healthStatus = observabilityManager.getHealthStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        metrics,
        auditLogs,
        healthStatus
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: 'メトリクスの取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * DELETE /api/metrics - メトリクスとログのリセット
 */
export async function DELETE(): Promise<NextResponse<ApiResponse<{
  message: string;
}>>> {
  try {
    observabilityManager.resetMetrics();
    observabilityManager.clearAuditLogs();
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'メトリクスとログがリセットされました'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'RESET_ERROR',
        message: 'リセットに失敗しました'
      }
    }, { status: 500 });
  }
}
