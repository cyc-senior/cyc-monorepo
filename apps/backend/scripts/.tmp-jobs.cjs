require('dotenv/config');
const { Client } = require(require.resolve('pg', { paths: [require.resolve('@prisma/adapter-pg')] }));
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
  const r = await c.query(`SELECT id, status, "variantCount", "baseVariantId" IS NOT NULL AS refine, "createdAt", "startedAt", "finishedAt", error, "outputMetadata" FROM generation_jobs ORDER BY "createdAt" DESC LIMIT 3`);
  for (const j of r.rows) { const om = j.outputMetadata; console.log(JSON.stringify({ ...j, outputMetadata: om && { variants: (om.variants||[]).map(v => ({ variant: v.variant, passed: v.passed, attempts: v.attempts, issues: (v.issues||[]).slice(0,3) })) } })); }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
