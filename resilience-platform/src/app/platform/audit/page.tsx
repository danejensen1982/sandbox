import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100, // Last 100 events
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case 'authentication':
        return 'default';
      case 'configuration':
        return 'secondary';
      case 'data_access':
        return 'outline';
      case 'export':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-slate-600 mt-1">
          System activity and security events (SOC 2 compliant logging)
        </p>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Showing the last 100 events</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No audit logs yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{log.eventType.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {log.eventDescription}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(log.eventCategory)}>
                        {log.eventCategory}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-slate-700">{log.actorType}</div>
                      {log.actorId && (
                        <div className="text-xs text-slate-400 font-mono truncate max-w-[100px]">
                          {log.actorId.substring(0, 8)}...
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.targetType ? (
                        <div>
                          <div className="text-slate-700">{log.targetType}</div>
                          {log.targetId && (
                            <div className="text-xs text-slate-400 font-mono truncate max-w-[100px]">
                              {log.targetId.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge variant="outline" className="text-green-600">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
