// Cada COR de bola = um CLUBE e um PODER:
//  azul (PORTO)   = velocidade
//  vermelho (BRAGA) = chute forte
//  verde (S.PEDRO/ADSPVC) = SIIIIIIIIIIII
import portoEmblem from '../assets/emblem_porto.png?url';
import bragaEmblem from '../assets/emblem_braga.png?url';
import greenPowerEmblem from '../assets/IMG_1809.png?url';

export const CLUBS = {
  speed: { club: 'PORTO',   power: 'VELOCIDADE',    ability: 'speed', ball: 0x1f5fd0, ring: 0x4aa3ff, ui: '#2f7be0', emblem: portoEmblem },
  kick:  { club: 'BRAGA',   power: 'CHUTE FORTE',   ability: 'kick',  ball: 0xd11a2a, ring: 0xff5161, ui: '#e8323f', emblem: bragaEmblem },
  jump:  { club: 'S.PEDRO', power: 'SIIIIIIIIIIII', ability: 'jump',  ball: 0x27c24a, ring: 0x6dff84, ui: '#27c24a', emblem: greenPowerEmblem },
};
export const CLUB_KEYS = ['speed', 'kick', 'jump'];
