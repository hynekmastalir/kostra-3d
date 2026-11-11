/* Zábavné části záložky Tance: bitva, rytmická hra, vlastní choreografie, fyzika kostry, studio (převleky, scény, nahrávání). */
import { createBattle } from './battle.js';
import { createRhythm } from './rhythm.js';
import { createComposer } from './composer.js';
import { createPuppet } from './puppet.js';
import { createStudio } from './studio.js';

export function createFun(core) {
  const sections = [createBattle(core), createRhythm(core), createComposer(core), createPuppet(core), createStudio(core)];
  return { sections, cleanup() { sections.forEach(s => s.cleanup?.()); } };
}
