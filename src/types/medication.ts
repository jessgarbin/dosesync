export type Frequency =
  | '1x_dia'
  | '2x_dia'
  | '3x_dia'
  | '4x_dia'
  | 'cada_4h'
  | 'cada_6h'
  | 'cada_8h'
  | 'cada_12h';

export type FoodCondition =
  | 'jejum'
  | 'antes_refeicao'
  | 'com_refeicao'
  | 'apos_refeicao'
  | 'antes_dormir'
  | 'qualquer';

export interface Medication {
  id: string;
  nome: string;
  dosagem: string;
  posologia: string;
  frequencia: Frequency;
  duracao_dias: number | null;
  condicao: FoodCondition;
  observacoes: string | null;
  lang?: 'pt' | 'en';
}
