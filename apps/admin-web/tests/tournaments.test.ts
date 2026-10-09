import assert from 'node:assert/strict';
import { it } from 'node:test';
import { newTournament, applyTournamentCommand } from '@ultimoturno/domain';
import { tournamentCsv, tournamentPrintHtml } from '../src/tournament-exports.js';
it('exports preserve TOM columns and escape participant names and formulas',()=>{
  let t=newTournament('<Copa>',1,0);
  t=applyTournamentCommand(t,{type:'addPlayer',name:'=1+1',playerId:''});
  t=applyTournamentCommand(t,{type:'addPlayer',name:'<script>"Hola"</script>',playerId:''});
  const csv=tournamentCsv(t);assert.match(csv,/"Standing","Name","Flight","Drop Round","Match Record","Match Points"/);
  assert.ok(csv.includes("\"'=1+1\""));
  const html=tournamentPrintHtml(t,'https://example.test');
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('https://example.test/brand/ultimo-turno-logo.jpeg'));
  assert.ok(html.includes('Posiciones provisionales'));
});
