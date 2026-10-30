export const KEYWORD_TOOLTIPS: Record<string, string> = {
  FRAGILE:
    'Formazione Fragile: in difesa subisce −1 al valore di Difesa (−2 se l’attaccante schiera almeno 1 formazione CORAZZATA).',
  INVERNO:
    'Specialisti Invernali: ignora tutti i malus invernali; se sovietica, riceve +1 in attacco durante i turni invernali.',
  URBANO:
    'Combattimento Urbano: +2 in difesa se il settore ha il marker su una città obiettivo ★ o la sta difendendo.',
  GUARDIA:
    'Unità della Guardia sovietica: titolo d’onore conferito alle formazioni promosse a VETERANA (+1 alla Forza massima).',
  ANTICARRO:
    'Equipaggiamento Anticarro: +2 alla Difesa per ogni carta ANTICARRO se l’attaccante ha almeno 1 formazione CORAZZATA.',
  PESANTE:
    'Mezzi Pesanti: impedisce la mobilità strategica estesa e la reazione rapida dalla Riserva.',
  RECLUTA: 'Livello Esperienza Recluta (+0 attacco/difesa). A 2 XP passa a Veterana.',
  VETERANA: 'Livello Esperienza Veterana (+1 attacco/difesa). A 4 XP passa a Elite.',
  ELITE: 'Livello Esperienza Elite (+2 attacco/difesa).',
  C: 'Requisito equipaggiamento: solo formazioni CORAZZATE.',
  FM: 'Requisito equipaggiamento: solo formazioni FANTERIA o MOTORIZZATE.',
  CM: 'Requisito equipaggiamento: solo formazioni CORAZZATE o MOTORIZZATE.',
  ANY: 'Requisito equipaggiamento: assegnabile a qualsiasi formazione.',
};

export const RULE_TOOLTIPS: Record<string, string> = {
  SUPERIORITA_AEREA:
    'Superiorità Aerea: chi ha la somma più alta di Caccia ha la superiorità aerea (+Supporto in attacco e +1 in difesa; in parità nessuno).',
  INVERNO:
    'Inverno Russo: malus attacco per le unità tedesche non-INVERNO (−3 in I41, −2 in I42, −1 in I43/I44). Le unità URSS con INVERNO hanno +1 in attacco.',
  RIFORNIMENTO:
    'Penalità di Rifornimento: linee logistiche allungate riducono il totale di attacco (e in profondità anche la difesa tedesca).',
};

export const PLAYTEST_QUESTIONS: string[] = [
  '1. Ci sono stati turni in cui avevo 2 o più opzioni buone e potevo farne una sola?',
  '2. Concentrare le forze in un settore ha pagato? Distribuirle ha portato allo stallo?',
  '3. Le riserve mobili hanno cambiato l’esito di qualche battaglia?',
  '4. Gli sfondamenti e gli accerchiamenti sono avvenuti? Troppo spesso o troppo raramente?',
  '5. La Germania ha sentito il punto culminante? Si è fermata da sola o è stata respinta?',
  '6. Il dado ha deciso partite? (vedi la metrica di impatto del dado)',
  '7. L’equipaggiamento scarso ha creato dilemmi su quale formazione rinforzare?',
  '8. Il passaggio ai mazzi del nuovo anno si è sentito?',
  '9. Il ritmo storico è emerso? Asse forte all’inizio, URSS in rimonta dal ’43?',
  '10. Quale meccanica disattiverei senza perdere nulla? (usa i toggle per verificarlo)',
];
