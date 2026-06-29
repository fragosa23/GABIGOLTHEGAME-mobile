// Cada COR de bola = um CLUBE e um PODER:
//  azul (PORTO)   = velocidade
//  vermelho (BRAGA) = chute forte
//  verde (S.PEDRO/ADSPVC) = super salto (duplo)
import portoEmblem from '../assets/emblem_porto.png?url';
import bragaEmblem from '../assets/emblem_braga.png?url';
import spedroEmblem from '../assets/emblem_spedro.png?url';

export const CLUBS = {
  speed: { club: 'PORTO',   power: 'VELOCIDADE',  ability: 'speed', ball: 0x1f5fd0, ring: 0x4aa3ff, ui: '#2f7be0', emblem: portoEmblem },
  kick:  { club: 'BRAGA',   power: 'CHUTE FORTE', ability: 'kick',  ball: 0xd11a2a, ring: 0xff5161, ui: '#e8323f', emblem: bragaEmblem },
  jump:  { club: 'S.PEDRO', power: 'SUPER SALTO', ability: 'jump',  ball: 0x27c24a, ring: 0x6dff84, ui: '#27c24a', emblem: spedroEmblem },
};
export const CLUB_KEYS = ['speed', 'kick', 'jump'];
