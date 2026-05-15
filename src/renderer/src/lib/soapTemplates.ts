/**
 * Templates SOAP por queixa frequente em UBS, baseados em diretrizes do
 * Ministério da Saúde e Cadernos de Atenção Básica. Servem como ponto de
 * partida — o profissional sempre revisa e personaliza antes de finalizar.
 */
export interface SoapTemplate {
  key: string
  label: string
  description: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  prescription: string
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    key: 'has-controlada',
    label: 'HAS — Hipertensão controlada (rotina)',
    description: 'Consulta de seguimento de paciente hipertenso em uso de anti-hipertensivo.',
    subjective:
      'Paciente em acompanhamento por HAS. Refere boa adesão à medicação. Nega cefaleia, dor torácica, dispneia, escotomas ou síncope. Mantém dieta hipossódica e atividade física regular.',
    objective:
      'BEG, LOC, corado, hidratado. PA: ___ mmHg. FC: ___ bpm. Ausculta cardiopulmonar sem alterações. Sem edema de MMII.',
    assessment: 'Hipertensão arterial sistêmica essencial — controlada. CID-10 I10.',
    plan: '1. Manter esquema anti-hipertensivo atual.\n2. Reforçar dieta DASH e atividade física aeróbica 150 min/semana.\n3. Monitorar PA em casa, anotar valores.\n4. Retorno em 3 meses com exames de rotina (hemograma, glicemia, perfil lipídico, creatinina, EAS, K).',
    prescription: ''
  },
  {
    key: 'dm2-controlado',
    label: 'DM Tipo 2 — Diabetes controlado (rotina)',
    description: 'Consulta de seguimento de paciente diabético tipo 2.',
    subjective:
      'Paciente diabético tipo 2 em acompanhamento. Refere uso regular de hipoglicemiante oral. Nega poliúria, polidipsia, polifagia ou perda de peso. Sem hipoglicemias recentes.',
    objective:
      'BEG. Peso ___ kg. IMC ___. PA: ___ mmHg. Glicemia capilar: ___ mg/dL. Pés sem lesões; sensibilidade preservada ao monofilamento. Pulsos pediosos palpáveis.',
    assessment:
      'Diabetes mellitus tipo 2 — controlado. CID-10 E11.9. Sem evidência de complicação crônica até o momento.',
    plan: '1. Manter hipoglicemiante atual.\n2. Reforçar dieta fracionada com restrição de carboidrato simples.\n3. Atividade física regular.\n4. Solicitar HbA1c, perfil lipídico, creatinina, EAS, microalbuminúria.\n5. Retorno em 3 meses com resultados.\n6. Encaminhar para fundo de olho anual.',
    prescription: ''
  },
  {
    key: 'ivas',
    label: 'IVAS — Resfriado / faringite viral',
    description: 'Quadro de infecção viral de vias aéreas superiores.',
    subjective:
      'Paciente refere coriza, dor de garganta leve e tosse seca há ___ dias. Nega febre alta, dispneia, dor torácica. Sem comorbidades relevantes.',
    objective:
      'BEG, afebril, eupneico. Orofaringe hiperemiada, sem placas. Otoscopia normal. Ausculta pulmonar sem alterações. SatO₂ ___%.',
    assessment: 'Infecção viral de vias aéreas superiores (IVAS). CID-10 J00.',
    plan: '1. Hidratação oral abundante.\n2. Sintomáticos conforme prescrição.\n3. Repouso relativo.\n4. Retornar em caso de febre persistente >72h, dispneia, dor torácica ou piora.',
    prescription:
      'Paracetamol 500mg — 1 cp VO até 6/6h se dor ou febre, por até 5 dias.\nDipirona 500mg — 1 cp VO até 6/6h se dor refratária ao paracetamol.'
  },
  {
    key: 'lombalgia',
    label: 'Dor lombar mecânica aguda',
    description: 'Lombalgia mecânica sem sinais de alerta.',
    subjective:
      'Paciente refere dor lombar há ___ dias, após esforço/movimento brusco. Sem irradiação para MMII, sem parestesia, sem alteração esfincteriana. Nega febre, perda de peso, trauma significativo.',
    objective:
      'BEG, marcha discretamente antálgica. Coluna lombar sem deformidades. Dor à palpação paravertebral L3-L5. Lasègue negativo bilateral. Força e sensibilidade preservadas em MMII. Reflexos simétricos.',
    assessment: 'Lombalgia mecânica aguda sem sinais de alerta. CID-10 M54.5.',
    plan: '1. Manter atividade habitual conforme tolerância (evitar repouso absoluto).\n2. Calor local 20 min, 2-3x/dia.\n3. Sintomáticos por até 7 dias.\n4. Retorno em 14 dias se persistência ou se surgirem sinais de alerta (irradiação, parestesia, fraqueza, febre).',
    prescription:
      'Paracetamol 750mg — 1 cp VO 8/8h por 5 dias.\nIbuprofeno 600mg — 1 cp VO 8/8h após refeições por até 5 dias (se sem contraindicações).'
  },
  {
    key: 'consulta-rotina',
    label: 'Consulta de rotina — adulto saudável',
    description: 'Avaliação geral em paciente assintomático.',
    subjective:
      'Paciente comparece para consulta de rotina. Nega queixas atuais. Nega tabagismo/etilismo. Atividade física ___. Alimentação ___.',
    objective:
      'BEG, LOC. Peso ___ kg. Altura ___. IMC ___. PA: ___ mmHg. FC: ___ bpm. Ausculta cardiopulmonar sem alterações. Abdome plano, indolor, sem visceromegalias.',
    assessment: 'Z00.0 — Exame médico geral. Sem alterações no exame físico atual.',
    plan: '1. Solicitar exames de rotina conforme idade/sexo: hemograma, glicemia, perfil lipídico, creatinina, TGO/TGP, TSH, EAS.\n2. Aferir PA em domicílio se possível.\n3. Reforçar hábitos saudáveis.\n4. Retorno em 30 dias com resultados.',
    prescription: ''
  },
  {
    key: 'gastroenterite',
    label: 'Gastroenterite aguda',
    description: 'Diarreia aguda sem sinais de gravidade.',
    subjective:
      'Paciente refere ___ episódios de diarreia há ___ dias, com/sem náusea e vômito. Nega febre alta, sangue, muco ou dor abdominal intensa. Refere ingesta hídrica adequada.',
    objective:
      'BEG, mucosas úmidas, hidratado. Sinais vitais estáveis. Abdome flácido, RHA presentes, doloroso à palpação difusa, sem sinais de peritonite.',
    assessment: 'Gastroenterite aguda provavelmente viral. CID-10 A09.',
    plan: '1. Hidratação oral com soro caseiro / SRO.\n2. Dieta leve, evitar lactose nos próximos 5 dias.\n3. Sintomáticos.\n4. Retornar imediatamente se: vômitos persistentes, sinais de desidratação, febre >38,5°C, sangue nas fezes, dor abdominal intensa.',
    prescription:
      'Soro de Reidratação Oral — 1 envelope diluído em 1L de água; 200ml após cada evacuação líquida.\nDimenidrinato 50mg — 1 cp VO 8/8h se náusea, por até 3 dias.'
  }
]
