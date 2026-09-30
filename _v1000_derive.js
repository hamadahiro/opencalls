const fs=require('fs');
const S=require('/Users/hh/Developer/Monographica/opencalls/shared.js');
const B=JSON.parse(fs.readFileSync('scripts/logs/2026-09-30-1000-batch.json','utf8'));
const D=JSON.parse(fs.readFileSync('data.json','utf8'));
const rows=D.calls||D; const by={}; rows.forEach(r=>by[r.slug]=r);
const slugs=B.batch.map(e=>e.slug);

console.log('=== requirementBucket: digit-carrying requirements bucketing to portfolio/null ===');
for(const s of slugs){const c=by[s]; const r=c.requirements;
  const b=S.deriveRequirementBucket(r);
  if(r && /\d/.test(r) && (b===null||b===undefined||b==='portfolio')) console.log('  ',s,'| req=',JSON.stringify(r),'-> bucket=',b);
}
console.log('=== requirementBucket: two-quantity strings (hand-compute) ===');
for(const s of slugs){const c=by[s]; const r=c.requirements||'';
  const nums=(r.match(/\d+/g)||[]);
  if(nums.length>=3) console.log('  ',s,'| req=',JSON.stringify(r),'-> bucket=',S.deriveRequirementBucket(r));
}
console.log('=== prize: parts carrying a currency figure deriving null ===');
for(const s of slugs){const c=by[s]; const p=c.prize; if(!p) continue;
  const parts=S.splitPrizeParts? S.splitPrizeParts(p):[p];
  for(const pt of parts){
    const cat=S.derivePrizeCategory(pt);
    if((cat===null||cat===undefined) && /[$€£¥₹₱]|\bzł\b|\d[\d,\.]*\s*(USD|EUR|GBP|CAD|SEK)/i.test(pt))
      console.log('  ',s,'| part=',JSON.stringify(pt),'-> null');
  }
}
console.log('=== prize: derivePrizeCategories EMPTY ===');
for(const s of slugs){const c=by[s]; const p=c.prize; if(!p) continue;
  const cats=S.derivePrizeCategories(p);
  if(!cats||cats.length===0) console.log('  ',s,'| prize=',JSON.stringify(p));
}
console.log('=== feeChip / shortenFee output for every fee ===');
for(const s of slugs){const c=by[s]; const f=c.fee;
  if(f===undefined) {console.log('  ABSENT fee:',s); continue;}
  const sh=S.shortenFee(f);
  if(f && sh && String(sh)!==String(f)) console.log('  ',s.padEnd(58),'|',JSON.stringify(f),'-> chip',JSON.stringify(sh));
}
