import { AccentOption, WordItem } from "../types/game";

export interface CurriculumPreset {
  id: string;
  title: string;
  levelLabel: string;
  words: Array<{
    word: string;
    ipaBritish: string;
    ipaAmerican: string;
  }>;
}

export const CURRICULUM_PRESETS: CurriculumPreset[] = [
  {
    id: "vietnam-hs-environment",
    title: "Unit 1: Environment & Global Change",
    levelLabel: "Grade 10–12 Core Vocabulary",
    words: [
      { word: "family", ipaBritish: "/ˈfæm.əl.i/", ipaAmerican: "/ˈfæm.əl.i/" },
      { word: "school", ipaBritish: "/skuːl/", ipaAmerican: "/skuːl/" },
      { word: "environment", ipaBritish: "/ɪnˈvaɪ.rən.mənt/", ipaAmerican: "/ɪnˈvaɪ.rən.mənt/" },
      { word: "renewable", ipaBritish: "/rɪˈnjuː.ə.bəl/", ipaAmerican: "/rɪˈnuː.ə.bəl/" },
      { word: "temperature", ipaBritish: "/ˈtem.prə.tʃər/", ipaAmerican: "/ˈtem.prə.tʃɚ/" },
      { word: "biodiversity", ipaBritish: "/ˌbaɪ.əʊ.daɪˈvɜː.sə.ti/", ipaAmerican: "/ˌbaɪ.oʊ.daɪˈvɝː.sə.ti/" },
      { word: "atmosphere", ipaBritish: "/ˈæt.məs.fɪər/", ipaAmerican: "/ˈæt.məs.fɪr/" },
      { word: "pollution", ipaBritish: "/pəˈluː.ʃən/", ipaAmerican: "/pəˈluː.ʃən/" },
      { word: "sustainable", ipaBritish: "/səˈsteɪ.nə.bəl/", ipaAmerican: "/səˈsteɪ.nə.bəl/" },
      { word: "protect", ipaBritish: "/prəˈtekt/", ipaAmerican: "/prəˈtekt/" },
    ],
  },
  {
    id: "vietnam-hs-technology",
    title: "Unit 2: Technology & Digital Future",
    levelLabel: "High School STEM & Communication",
    words: [
      { word: "technology", ipaBritish: "/tekˈnɒl.ə.dʒi/", ipaAmerican: "/tekˈnɑː.lə.dʒi/" },
      { word: "algorithm", ipaBritish: "/ˈæl.ɡə.rɪ.ðəm/", ipaAmerican: "/ˈæl.ɡə.rɪ.ðəm/" },
      { word: "communication", ipaBritish: "/kəˌmjuː.nɪˈkeɪ.ʃən/", ipaAmerican: "/kəˌmjuː.nəˈkeɪ.ʃən/" },
      { word: "information", ipaBritish: "/ˌɪn.fəˈmeɪ.ʃən/", ipaAmerican: "/ˌɪn.fɚˈmeɪ.ʃən/" },
      { word: "artificial", ipaBritish: "/ˌɑː.tɪˈfɪʃ.əl/", ipaAmerican: "/ˌɑːr.t̬əˈfɪʃ.əl/" },
      { word: "software", ipaBritish: "/ˈsɒft.weər/", ipaAmerican: "/ˈsɑːft.wer/" },
      { word: "engineer", ipaBritish: "/ˌen.dʒɪˈnɪər/", ipaAmerican: "/ˌen.dʒɪˈnɪr/" },
      { word: "invention", ipaBritish: "/ɪnˈven.ʃən/", ipaAmerican: "/ɪnˈven.ʃən/" },
      { word: "research", ipaBritish: "/rɪˈsɜːtʃ/", ipaAmerican: "/ˈriː.sɜːrtʃ/" },
      { word: "connect", ipaBritish: "/kəˈnekt/", ipaAmerican: "/kəˈnekt/" },
    ],
  },
  {
    id: "vietnam-hs-tricky-sounds",
    title: "Unit 3: Final Sounds & Word Stress Challenge",
    levelLabel: "Targeted Phonetics Practice",
    words: [
      { word: "breakfast", ipaBritish: "/ˈbrek.fəst/", ipaAmerican: "/ˈbrek.fəst/" },
      { word: "comfortable", ipaBritish: "/ˈkʌm.fə.tə.bəl/", ipaAmerican: "/ˈkʌm.fɚ.t̬ə.bəl/" },
      { word: "vegetable", ipaBritish: "/ˈvedʒ.tə.bəl/", ipaAmerican: "/ˈvedʒ.tə.bəl/" },
      { word: "schedule", ipaBritish: "/ˈʃedʒ.uːl/", ipaAmerican: "/ˈskedʒ.uːl/" },
      { word: "thousand", ipaBritish: "/ˈθaʊ.zənd/", ipaAmerican: "/ˈθaʊ.zənd/" },
      { word: "clothes", ipaBritish: "/kləʊðz/", ipaAmerican: "/kloʊðz/" },
      { word: "education", ipaBritish: "/ˌedʒ.ʊˈkeɪ.ʃən/", ipaAmerican: "/ˌedʒ.əˈkeɪ.ʃən/" },
      { word: "photograph", ipaBritish: "/ˈfəʊ.tə.ɡrɑːf/", ipaAmerican: "/ˈfoʊ.t̬ə.ɡræf/" },
      { word: "important", ipaBritish: "/ɪmˈpɔː.tənt/", ipaAmerican: "/ɪmˈpɔːr.tənt/" },
      { word: "successful", ipaBritish: "/səkˈses.fəl/", ipaAmerican: "/səkˈses.fəl/" },
    ],
  },
];

export function buildWordItemsFromPreset(
  preset: CurriculumPreset,
  accent: AccentOption
): WordItem[] {
  return preset.words.map((entry, idx) => ({
    id: `word-${idx + 1}-${entry.word}`,
    word: entry.word,
    ipa: accent === "British" ? entry.ipaBritish : entry.ipaAmerican,
  }));
}
