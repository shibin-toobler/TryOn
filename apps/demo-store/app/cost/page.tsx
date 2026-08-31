import React from 'react';
import { Activity, DollarSign, Image as ImageIcon, CheckCircle2, XCircle, TrendingUp, Sparkles, Box } from 'lucide-react';
import './cost.css';

async function getUsageData() {
  const apiUrl = process.env.NEXT_PUBLIC_TRYON_API_URL || 'http://localhost:4000';
  const secretKey = process.env.TRYON_SECRET_KEY;

  if (!secretKey) {
    throw new Error('TRYON_SECRET_KEY is not configured in .env.local');
  }

  const res = await fetch(`${apiUrl}/v1/admin/usage`, {
    headers: {
      'x-tryon-secret': secretKey,
    },
    // Don't cache so the dashboard is always fresh
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch usage data: ${res.status} ${errorText}`);
  }

  return res.json();
}

export default async function CostDashboard() {
  try {
    const data = await getUsageData();
    const { totals, daily, topProducts } = data;

    return (
      <main className="cost-page">
        <div className="cost-container">
          <header className="cost-header">
            <h1><Sparkles size={32} style={{ display: 'inline', marginRight: '12px', verticalAlign: 'middle', color: '#a26bfc' }} /> API Cost & Usage</h1>
            <p>Real-time analytics for your Try-On generation expenses.</p>
          </header>

          <section className="cost-grid">
            <article className="cost-card">
              <div className="cost-card-title">
                <ImageIcon size={18} /> Total Generations
              </div>
              <div className="cost-card-value">{totals.generations.toLocaleString()}</div>
              <div className="cost-card-sub" style={{ color: '#8b92a5' }}>
                <CheckCircle2 size={12} style={{ display: 'inline', color: '#10b981' }} /> {totals.succeeded} succeeded
                {' · '}
                <XCircle size={12} style={{ display: 'inline', color: '#ef4444' }} /> {totals.failed} failed
              </div>
            </article>

            <article className="cost-card">
              <div className="cost-card-title">
                <DollarSign size={18} /> Total Cost (USD)
              </div>
              <div className="cost-card-value">${totals.costUsd.toFixed(2)}</div>
              <div className="cost-card-sub" style={{ color: '#8b92a5' }}>
                ≈ ₹{totals.costInr.toLocaleString()}
              </div>
            </article>

            <article className="cost-card">
              <div className="cost-card-title">
                <TrendingUp size={18} /> Cache Savings
              </div>
              <div className="cost-card-value">${totals.savedUsd.toFixed(2)}</div>
              <div className="cost-card-sub">
                {totals.cacheHits} cache hits
              </div>
            </article>

            <article className="cost-card">
              <div className="cost-card-title">
                <Activity size={18} /> Avg Cost / Render
              </div>
              <div className="cost-card-value">${totals.avgCostPerRenderUsd.toFixed(3)}</div>
              <div className="cost-card-sub" style={{ color: '#8b92a5' }}>
                Per successful API call
              </div>
            </article>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section className="cost-section">
              <h2><Activity size={20} color="#a26bfc" /> Daily Breakdown</h2>
              <div className="cost-table-wrapper">
                <table className="cost-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Generations</th>
                      <th>Cost (USD)</th>
                      <th>Cache Hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((day: any) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{day.generations} <span className="cost-badge" style={{ marginLeft: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>{day.succeeded} ok</span></td>
                        <td>${day.costUsd.toFixed(2)}</td>
                        <td>{day.cacheHits}</td>
                      </tr>
                    ))}
                    {daily.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#8b92a5' }}>No activity recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cost-section">
              <h2><Box size={20} color="#35a2eb" /> Top Products by Cost</h2>
              <div className="cost-table-wrapper">
                <table className="cost-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Generations</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product: any) => (
                      <tr key={product.externalId}>
                        <td>
                          <div style={{ fontWeight: 500, color: '#fff' }}>{product.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#8b92a5' }}>{product.externalId}</div>
                        </td>
                        <td>{product.generations} <span className="cost-badge" style={{ marginLeft: '8px' }}>{product.cacheHits} cached</span></td>
                        <td>${product.costUsd.toFixed(3)}</td>
                      </tr>
                    ))}
                    {topProducts.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#8b92a5' }}>No products tested yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="cost-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cost-error">
          <XCircle size={48} style={{ margin: '0 auto 1rem auto' }} />
          <h2>Dashboard Error</h2>
          <p>{error.message || 'Unknown error occurred while fetching usage data.'}</p>
        </div>
      </main>
    );
  }
}
