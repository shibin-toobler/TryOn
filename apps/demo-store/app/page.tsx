'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Heart, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { TryOnScript } from './TryOnScript';
import { products, type Product } from './products';

/**
 * A stand-in merchant storefront. It contains no try-on logic whatsoever — the
 * only integration points are <TryOnScript /> and the data-tryon-product
 * attribute on the buttons below. Everything else is the plugin's job.
 */
export default function Home() {
  const [detail, setDetail] = useState<Product | null>(null);
  const [category, setCategory] = useState('All');

  const visible = useMemo(
    () => (category === 'All' ? products : products.filter((p) => p.color === category)),
    [category],
  );

  return (
    <main>
      <TryOnScript />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>SELENE
        </div>
        <nav>
          <button>New In</button>
          <button onClick={() => setCategory('All')}>Dresses</button>
          <button>Collections</button>
          <button>Journal</button>
        </nav>
        <div className="actions">
          <button className="icon">
            <Search size={18} />
          </button>
          <button className="icon">
            <Heart size={18} />
          </button>
          <button className="icon">
            <ShoppingBag size={18} />
            <i>2</i>
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={13} /> VIRTUAL TRY-ON STUDIO
          </p>
          <h1>
            See it.
            <br />
            <em>Wear it.</em>
            <br />
            Make it yours.
          </h1>
          <p className="hero-text">
            Browse freely. When something catches your eye, try it on without leaving the page.
          </p>
          {/* Same attribute as the product cards — the plugin binds it for us. */}
          <button className="primary" data-tryon-product={products[0].sku}>
            Try a look <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-image">
          <img src={products[2].image} alt="Fashion editorial" />
          <span>
            NEW SEASON
            <br />
            <b>FW / 26</b>
          </span>
        </div>
      </section>

      <section className="catalog">
        <div className="section-head">
          <div>
            <p className="eyebrow">THE EDIT</p>
            <h2>Made for your next chapter.</h2>
          </div>
          <small>{visible.length.toString().padStart(2, '0')} pieces</small>
        </div>

        <div className="filters">
          {['All', 'Midnight', 'Champagne', 'Berry'].map((name) => (
            <button
              key={name}
              className={category === name ? 'active' : ''}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="grid">
          {visible.map((p) => (
            <article className="card" key={p.sku}>
              <div className="card-image">
                <img src={p.image} alt={p.name} />
                <button className="heart">
                  <Heart size={17} />
                </button>
                {/* The entire integration: one attribute carrying our SKU. */}
                <button className="try" data-tryon-product={p.sku}>
                  <Sparkles size={14} /> Try on
                </button>
              </div>
              <div className="meta">
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.color} · Dresses</span>
                </div>
                <b>₹{p.price.toLocaleString('en-IN')}</b>
              </div>
              <button className="details" onClick={() => setDetail(p)}>
                View details <ArrowRight size={13} />
              </button>
            </article>
          ))}
        </div>
      </section>

      {detail && <Detail p={detail} close={() => setDetail(null)} />}
    </main>
  );
}

function Detail({ p, close }: { p: Product; close: () => void }) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <div className="detail" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          <X size={19} />
        </button>
        <div className="detail-img">
          <img src={p.image} alt={p.name} />
          <span>FW / 26</span>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">SELENE · THE EDIT</p>
          <h2>{p.name}</h2>
          <strong className="price">₹{p.price.toLocaleString('en-IN')}</strong>
          <p className="desc">{p.description}</p>
          <label>COLOR</label>
          <div className="swatches">
            <i />
            <i />
            <i />
          </div>
          <label>SIZE</label>
          <div className="sizes">
            {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
              <button key={size} className={size === 'M' ? 'chosen' : ''}>
                {size}
              </button>
            ))}
          </div>
          <button className="try-detail" data-tryon-product={p.sku} onClick={close}>
            <Sparkles size={17} /> Try it on me
          </button>
          <button className="bag">
            Add to bag <ShoppingBag size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
