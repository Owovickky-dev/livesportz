# TODO: Fix commentary tags schema mismatch

- [ ] Step 1: Update src/db/schema.js - change tags: text("tags") to tags: jsonb("tags").$type<string[]>().default("[]")
- [ ] Step 2: Update src/routes/commentary.js - remove manual tags JSON.stringify handling
- [ ] Step 3: Run `npm run db:generate &amp;&amp; npm run db:migrate`
- [ ] Step 4: Test POST /matches/:id/commentary with tags array, verify storage/retrieval
- [ ] Step 5: Update TODO.md with completion
