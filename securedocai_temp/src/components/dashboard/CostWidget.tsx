import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCostTracking } from '@/hooks/useCostTracking';
import { Coins, Loader2, TrendingUp } from 'lucide-react';

export function CostWidget() {
  const { sessionCost, lifetimeCost, isLoading } = useCostTracking();

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">AI Credits Used</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">This Session</span>
              <span className="font-semibold text-foreground">{formatCost(sessionCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Lifetime Total
              </span>
              <span className="font-semibold text-foreground">{formatCost(lifetimeCost)}</span>
            </div>
            {lifetimeCost > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Based on Gemini 2.5 Flash pricing
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
