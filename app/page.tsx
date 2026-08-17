'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { ArrowRight, Heart, ImagePlus, Search, ShoppingBag, Sparkles, Upload, X } from 'lucide-react';

type Product = { id:number; name:string; color:string; price:number; image:string; description:string };
const products: Product[] = [
 {id:1,name:'Silk Column Dress',color:'Midnight',price:2890,image:'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=900&q=85',description:'Fluid silk with a softly sculpted waist and a clean modern finish.'},
 {id:2,name:'Satin Slip Dress',color:'Champagne',price:2490,image:'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=85',description:'Liquid satin, delicate straps and an effortless evening drape.'},
 {id:3,name:'Tailored Midi',color:'Berry',price:3190,image:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=85',description:'A precise midi cut with elegant structure and a confident line.'},
 {id:4,name:'Linen Wrap Dress',color:'Olive',price:2190,image:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85',description:'Relaxed linen with a wrap waist and natural movement.'},
 {id:5,name:'Asymmetric Pleat Dress',color:'Ink',price:3490,image:'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=900&q=85',description:'Architectural pleats and an asymmetric hem for a sharper statement.'},
 {id:6,name:'Soft Knit Maxi',color:'Sand',price:2790,image:'https://images.unsplash.com/photo-1612336307429-8a898d10e223?auto=format&fit=crop&w=900&q=85',description:'Soft-touch knit with a minimal shape and effortless movement.'}
];

type Look = { id:string; label:string; image:string; product?:Product };

export default function Home(){
 const [selected,setSelected]=useState<Product|null>(null);
 const [tried,setTried]=useState<Product[]>([]);
 const [photo,setPhoto]=useState<string|null>(null);
 const [detail,setDetail]=useState<Product|null>(null);
 const [showStudio,setShowStudio]=useState(true);
 const [uploading,setUploading]=useState(false);
 const [category,setCategory]=useState('All');
 const visible=useMemo(()=>category==='All'?products:products.filter(p=>p.color===category),[category]);
 const looks:Look[] = [...(photo?[{id:'me',label:'My photo',image:photo}]:[]),...tried.map(p=>({id:String(p.id),label:p.name,image:p.image,product:p}))];
 const choose=(p:Product)=>{setSelected(p);setTried(v=>[p,...v.filter(x=>x.id!==p.id)].slice(0,5));setShowStudio(true)};
 const selectLook=(look:Look)=>look.product?choose(look.product):setSelected(null);
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);const reader=new FileReader();reader.onload=()=>{setPhoto(String(reader.result));setSelected(null);setUploading(false);};reader.readAsDataURL(file)};
 return <main className={showStudio?'with-studio':''}>
  <header className="topbar"><div className="brand"><span className="brand-mark">S</span>SELENE</div><nav><button>New In</button><button onClick={()=>setCategory('All')}>Dresses</button><button>Collections</button><button>Journal</button></nav><div className="actions"><button className="icon"><Search size={18}/></button><button className="icon"><Heart size={18}/></button><button className="icon"><ShoppingBag size={18}/><i>2</i></button></div></header>
  <section className="hero"><div className="hero-copy"><p className="eyebrow"><Sparkles size={13}/> VIRTUAL TRY-ON STUDIO</p><h1>See it.<br/><em>Wear it.</em><br/>Make it yours.</h1><p className="hero-text">Browse freely. When something catches your eye, try it on without leaving the shopping page.</p><button className="primary" onClick={()=>setShowStudio(true)}>Open try-on <ArrowRight size={16}/></button></div><div className="hero-image"><img src={products[2].image} alt="Fashion editorial"/><span>NEW SEASON<br/><b>FW / 26</b></span></div></section>
  <section className="catalog"><div className="section-head"><div><p className="eyebrow">THE EDIT</p><h2>Made for your next chapter.</h2></div><small>{visible.length.toString().padStart(2,'0')} pieces</small></div><div className="filters"><button className={category==='All'?'active':''} onClick={()=>setCategory('All')}>All</button><button className={category==='Midnight'?'active':''} onClick={()=>setCategory('Midnight')}>Midnight</button><button className={category==='Champagne'?'active':''} onClick={()=>setCategory('Champagne')}>Champagne</button><button className={category==='Berry'?'active':''} onClick={()=>setCategory('Berry')}>Berry</button></div><div className="grid">{visible.map(p=><article className="card" key={p.id}><div className="card-image"><img src={p.image} alt={p.name}/><button className="heart"><Heart size={17}/></button><button className="try" onClick={()=>choose(p)}><Sparkles size={14}/> Try on</button></div><div className="meta"><div><strong>{p.name}</strong><span>{p.color} · Dresses</span></div><b>₹{p.price.toLocaleString('en-IN')}</b></div><button className="details" onClick={()=>setDetail(p)}>View details <ArrowRight size={13}/></button></article>)}</div></section>
  {detail&&<Detail p={detail} close={()=>setDetail(null)} tryIt={()=>{setDetail(null);choose(detail)}}/>}
  {showStudio&&<TryOnPanel p={selected} photo={photo} looks={looks} uploading={uploading} selectLook={selectLook} upload={upload} close={()=>setShowStudio(false)} />}
 </main>
}

function TryOnPanel({p,photo,looks,uploading,selectLook,upload,close}:{p:Product|null;photo:string|null;looks:Look[];uploading:boolean;selectLook:(look:Look)=>void;upload:(e:ChangeEvent<HTMLInputElement>)=>void;close:()=>void}){
 const previewImage=p?.image??photo; const hasPreview=Boolean(previewImage);
 return <aside className="floating-studio v3-studio">
  <div className="panel-top"><div><p className="eyebrow"><Sparkles size={12}/> TRY-ON</p><h3>{p?(photo?'Your look':'Selected look'):'See it on you.'}</h3></div><button className="panel-close" onClick={close}><X size={17}/></button></div>
  <div className="panel-stage v3-stage">
   {hasPreview?<div className="model-preview"><img src={previewImage!} alt={p?`Selected ${p.name}`:'Your uploaded model'}/><div className="preview-shade v3-shade"/>{p&&<div className="look-chip v3-chip"><Sparkles size={13}/><span><b>{p.name}</b><small>{photo?'UI try-on preview':'Selected look · upload photo to try on'}</small></span></div>}{looks.length>0&&<div className="preview-look-dock">{looks.map(l=><button type="button" key={l.id} aria-label={`Show ${l.label}`} className={`preview-thumb ${l.product?.id===p?.id||(!l.product&&!p)?'active':''}`} onClick={()=>selectLook(l)}><img src={l.image} alt={l.label}/></button>)}</div>}</div>:<div className="empty-model"><div className="upload-orb"><ImagePlus size={25}/></div><h4>Start with your photo</h4><p>Upload once, then keep browsing. Your photo stays here while you try different looks.</p><label className="upload-btn"><Upload size={15}/>{uploading?'Reading photo…':'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/></label><span className="helper">Full-body photo works best · JPG, PNG or WebP</span></div>}
  </div>
  {photo&&<div className="panel-info v3-info"><span><b>{p?p.name:'My photo'}</b>{p&&<> · {p.color}</>}</span><label className="change-photo">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/></label></div>}
  <div className="panel-footer v3-footer">{p&&photo?<><button className="secondary">See in motion <Sparkles size={14}/></button><button className="primary small">View product <ArrowRight size={14}/></button></>:p?<span>Upload your photo to see <b>{p.name}</b> on you.</span>:<span>Choose <b>Try on</b> on any product card to preview it here.</span>}</div>
 </aside>
}

function Detail({p,close,tryIt}:{p:Product;close:()=>void;tryIt:()=>void}){return <div className="backdrop"><div className="detail"><button className="close" onClick={close}><X size={19}/></button><div className="detail-img"><img src={p.image} alt={p.name}/><span>FW / 26</span></div><div className="detail-copy"><p className="eyebrow">SELENE · THE EDIT</p><h2>{p.name}</h2><strong className="price">₹{p.price.toLocaleString('en-IN')}</strong><p className="desc">{p.description}</p><label>COLOR</label><div className="swatches"><i/><i/><i/></div><label>SIZE</label><div className="sizes"><button>XS</button><button>S</button><button className="chosen">M</button><button>L</button><button>XL</button></div><button className="try-detail" onClick={tryIt}><Sparkles size={17}/> Try it on me</button><button className="bag">Add to bag <ShoppingBag size={16}/></button></div></div></div>}
