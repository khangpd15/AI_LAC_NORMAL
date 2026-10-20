// Iris is RemiCare's narrator persona, backed by the existing Google Vietnamese
// stream used in its listening guides. It is not a separate vendor voice ID.
export const IRIS_VOICE = Object.freeze({
  name: 'Iris',
  lang: 'vi-VN',
  provider: 'google-translate',
});

export function getIrisAudioUrls(text) {
  const encoded = encodeURIComponent(text.trim());
  return [
    `/api/tts?text=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`,
    `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encoded}`,
  ];
}
