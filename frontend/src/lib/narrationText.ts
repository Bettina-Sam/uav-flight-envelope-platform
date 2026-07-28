import type { PredictResponse, DesignScoreResponse } from '../types';
import { formatDurationLong } from './duration';

type NarrationLanguage = 'en' | 'hi' | 'ta';

export function narratePhysics(r: PredictResponse, language: NarrationLanguage = 'en'): string {
  const p = r.physics;
  if (language === 'hi') return `भौतिकी परिणाम। अनुमानित सहनकाल ${formatDurationLong(p.endurance_hr)} है और रेंज मान ${p.range_km.toFixed(2)} है। लिफ्ट टू ड्रैग अनुपात ${p.l_over_d.toFixed(1)} है। सुरक्षा स्थिति ${p.safety_status} है।`;
  if (language === 'ta') return `இயற்பியல் முடிவுகள். கணிக்கப்பட்ட தாங்கும் நேரம் ${formatDurationLong(p.endurance_hr)}, தூர மதிப்பு ${p.range_km.toFixed(2)}. லிஃப்ட் டு டிராக் விகிதம் ${p.l_over_d.toFixed(1)}. பாதுகாப்பு நிலை ${p.safety_status}.`;
  return `Physics results. Estimated endurance is ${formatDurationLong(p.endurance_hr)}, `
    + `with a range value of ${p.range_km.toFixed(2)}. The lift to drag ratio is ${p.l_over_d.toFixed(1)}. `
    + `Overall safety status is ${p.safety_status}. ${p.warnings.length ? 'Warnings: ' + p.warnings.join('. ') : 'No warnings were raised for this configuration.'}`;
}

export function narrateML(r: PredictResponse, language: NarrationLanguage = 'en'): string {
  const ml = r.ml;
  if (language === 'hi') return `मशीन लर्निंग पूर्वानुमान, ${ml.model_used} मॉडल द्वारा। अनुमानित सहनकाल ${formatDurationLong(ml.endurance_hr)} और रेंज मान ${ml.range_km.toFixed(2)} है। सुरक्षा वर्गीकरण विश्वास ${Math.round(ml.safety_confidence * 100)} प्रतिशत और विश्वसनीयता स्कोर ${Math.round(ml.reliability_score * 100)} प्रतिशत है।`;
  if (language === 'ta') return `இயந்திரக் கற்றல் கணிப்பு, ${ml.model_used} மாதிரி. கணிக்கப்பட்ட தாங்கும் நேரம் ${formatDurationLong(ml.endurance_hr)}, தூர மதிப்பு ${ml.range_km.toFixed(2)}. பாதுகாப்பு வகைப்பாட்டு நம்பிக்கை ${Math.round(ml.safety_confidence * 100)} சதவீதம், நம்பகத்தன்மை மதிப்பெண் ${Math.round(ml.reliability_score * 100)} சதவீதம்.`;
  return `Machine learning prediction, using the ${ml.model_used} model. `
    + `Predicted endurance is ${formatDurationLong(ml.endurance_hr)} and range value is ${ml.range_km.toFixed(2)}, with a safety classifier confidence of `
    + `${Math.round(ml.safety_confidence * 100)} percent, and an overall reliability score of ${Math.round(ml.reliability_score * 100)} percent.`;
}

export function narrateDashboard(r: PredictResponse, score?: DesignScoreResponse | null, language: NarrationLanguage = 'en'): string {
  const p = r.physics;
  if (language === 'hi') return `डैशबोर्ड सारांश। सहनकाल ${formatDurationLong(p.endurance_hr)}, रेंज मान ${p.range_km.toFixed(2)}, चढ़ाई दर ${p.rate_of_climb_ms.toFixed(1)} मीटर प्रति सेकंड और सुरक्षा स्थिति ${p.safety_status} है।${score ? ` डिज़ाइन स्कोर ${Math.round(score.total)} में से 100, ग्रेड ${score.grade} है।` : ''}`;
  if (language === 'ta') return `டாஷ்போர்டு சுருக்கம். தாங்கும் நேரம் ${formatDurationLong(p.endurance_hr)}, தூர மதிப்பு ${p.range_km.toFixed(2)}, ஏற்ற விகிதம் வினாடிக்கு ${p.rate_of_climb_ms.toFixed(1)} மீட்டர், பாதுகாப்பு நிலை ${p.safety_status}.${score ? ` வடிவமைப்பு மதிப்பெண் 100-ல் ${Math.round(score.total)}, தரம் ${score.grade}.` : ''}`;
  let s = `Flight envelope dashboard summary. Endurance ${formatDurationLong(p.endurance_hr)}, `
    + `range value ${p.range_km.toFixed(2)}, rate of climb ${p.rate_of_climb_ms.toFixed(1)} meters per second, safety status ${p.safety_status}.`;
  if (score) s += ` Overall design score is ${Math.round(score.total)} out of 100, grade ${score.grade}.`;
  return s;
}

export function narrateMissionSummary(missionType: string, waypointCount: number, durationMin: number, distanceKm: number, batteryMarginPct: number, language: NarrationLanguage = 'en'): string {
  if (language === 'hi') return `${missionType} मिशन सारांश। ${waypointCount} वेपॉइंट, अनुमानित अवधि ${Math.round(durationMin)} मिनट, दूरी ${distanceKm.toFixed(1)} किलोमीटर और ऊर्जा मार्जिन ${Math.round(batteryMarginPct)} प्रतिशत है।`;
  if (language === 'ta') return `${missionType} மிஷன் சுருக்கம். ${waypointCount} வழிப்புள்ளிகள், கணிக்கப்பட்ட காலம் ${Math.round(durationMin)} நிமிடங்கள், தூரம் ${distanceKm.toFixed(1)} கிலோமீட்டர், ஆற்றல் இருப்பு ${Math.round(batteryMarginPct)} சதவீதம்.`;
  return `Mission summary for a ${missionType} mission with ${waypointCount} waypoints. `
    + `Estimated duration is ${Math.round(durationMin)} minutes, covering ${distanceKm.toFixed(1)} kilometers, `
    + `with a battery margin of ${Math.round(batteryMarginPct)} percent. `
    + `${batteryMarginPct < 0 ? 'Warning: this mission exceeds the available battery capacity as planned.' : 'This mission is within the aircraft\u2019s energy budget.'}`;
}

const ENGLISH_DESCRIPTIONS: Record<string, string> = {
  '/': 'This is the home page. It introduces the platform: a physics-informed machine learning system for predicting UAV flight envelopes, comparing a physics engine against a trained model, and planning missions.',
  '/input': 'This is the UAV Input page. Enter your aircraft\u2019s design parameters here, grouped by geometry, aerodynamics, propulsion, weight, and battery. Each field is checked against the machine learning model\u2019s training range.',
  '/physics': 'This is the Physics Results page. It shows first-principles aerodynamic performance, including climb rate, range, endurance, and a safety assessment.',
  '/ml': 'This is the Machine Learning Prediction page. It shows what the trained surrogate model predicts from the same inputs, along with confidence intervals and an explanation of which features drove the prediction.',
  '/dashboard': 'This is the Flight Envelope Dashboard. It combines range, endurance, aerodynamic performance, and your overall design score in one view.',
  '/comparison': 'This is the Physics versus Machine Learning comparison page. It checks every shared prediction between the two methods and flags any disagreement.',
  '/performance': 'This is the Performance Analysis page, covering range and endurance through physics, machine learning, sensitivity, and optimization suggestions.',
  '/uncertainty': 'This is the Uncertainty Quantification page. It separates aleatoric uncertainty, from real-world variability, and epistemic uncertainty, from model knowledge limits, and benchmarks seven machine learning algorithms.',
  '/mission': 'This is the Mission Planner. Search a location or click the map to place waypoints, then compute a terrain-aware altitude profile and energy budget for the mission.',
  '/design-studio': 'This is the Design Studio, combining the Auto Design optimizer, which searches for a configuration matching your targets, and Failure Simulation, which stress-tests your current design.',
  '/report': 'This is the Report page. Generate a full PDF or CSV engineering report, and manage your saved configurations here.',
  '/command-center': 'This is the Command Center, a consolidated three-dimensional mission performance view of range, endurance, design score, and live tuning.',
  '/missions': 'This is the Global Mission Map, showing every mission you\u2019ve planned across sessions on one map.',
  default: 'This page is part of the UAV performance platform, a physics-informed machine learning system for UAV design analysis.',
};

export const PAGE_DESCRIPTIONS: Record<'en' | 'hi' | 'ta', Record<string, string>> = {
  en: ENGLISH_DESCRIPTIONS,
  hi: {
    '/': 'यह होम पेज है। यह यूएवी रेंज, सहनकाल, भौतिकी और मशीन लर्निंग तुलना तथा मिशन योजना प्रणाली का परिचय देता है।',
    '/input': 'यह यूएवी इनपुट पेज है। यहाँ विमान की ज्यामिति, वायुगतिकी, प्रणोदन, भार, ईंधन और बैटरी के मान दर्ज करें।',
    '/physics': 'यह भौतिकी परिणाम पेज है। इसमें रेंज, सहनकाल, चढ़ाई दर, वायुगतिकीय प्रदर्शन और सुरक्षा मूल्यांकन दिखते हैं।',
    '/ml': 'यह मशीन लर्निंग पूर्वानुमान पेज है। यह एक्स जी बूस्ट मॉडल के अनुमान, विश्वसनीयता अंतराल और फीचर प्रभाव दिखाता है।',
    '/dashboard': 'यह फ्लाइट एनवेलप डैशबोर्ड है। इसमें रेंज, सहनकाल, वायुगतिकीय प्रदर्शन और डिज़ाइन स्कोर एक साथ दिखते हैं।',
    '/comparison': 'यह भौतिकी और मशीन लर्निंग तुलना पेज है। यह सभी गैर-ऊंचाई प्रदर्शन मानों के अंतर दिखाता है।',
    '/performance': 'यह प्रदर्शन विश्लेषण पेज है। इसमें रेंज और सहनकाल की संवेदनशीलता तथा सुधार सुझाव दिखते हैं।',
    '/uncertainty': 'यह अनिश्चितता विश्लेषण पेज है। इसमें वास्तविक परिवर्तनशीलता और मॉडल ज्ञान की अनिश्चितता अलग-अलग दिखाई जाती है।',
    '/mission': 'यह मिशन प्लानर है। मानचित्र पर वेपॉइंट रखें और भू-भाग आधारित सुरक्षित यात्रा ऊंचाई, ऊर्जा तथा अवधि की गणना करें।',
    '/design-studio': 'यह डिज़ाइन स्टूडियो है। इसमें स्वचालित डिज़ाइन खोज और विफलता सिमुलेशन उपलब्ध हैं।',
    '/report': 'यह रिपोर्ट पेज है। यहाँ पीडीएफ या सीएसवी इंजीनियरिंग रिपोर्ट बनाएं और सहेजे गए विन्यास प्रबंधित करें।',
    '/command-center': 'यह मिशन कंट्रोल है। इसमें चलती हुई त्रि-आयामी रेंज और सहनकाल दृश्यावली, डिज़ाइन स्कोर और लाइव समायोजन हैं।',
    '/missions': 'यह वैश्विक मिशन मानचित्र है। प्रत्येक सहेजे गए मिशन का अपना चलायमान विमान और मार्ग है।',
    '/feature-importance': 'यह फीचर महत्व और मॉडल तुलना पेज है। यह एक्स जी बूस्ट की फीचर महत्ता और परीक्षण प्रदर्शन दिखाता है।',
    '/sensitivity': 'यह संवेदनशीलता पेज है। यह दिखाता है कि इनपुट बदलने पर प्रदर्शन परिणाम कैसे बदलते हैं।',
    '/about': 'यह परिचय और सूत्र संदर्भ पेज है। इसमें वर्तमान गणनाएँ, मान्यताएँ और सीमाएँ समझाई गई हैं।',
    default: 'यह पेज यूएवी प्रदर्शन प्लेटफ़ॉर्म का भाग है, जो भौतिकी और मशीन लर्निंग आधारित डिज़ाइन विश्लेषण प्रणाली है।',
  },
  ta: {
    '/': 'இது முகப்புப் பக்கம். UAV தூரம், தாங்கும் நேரம், இயற்பியல் மற்றும் இயந்திரக் கற்றல் ஒப்பீடு, மிஷன் திட்டமிடல் ஆகியவற்றை அறிமுகப்படுத்துகிறது.',
    '/input': 'இது UAV உள்ளீட்டுப் பக்கம். விமான வடிவியல், காற்றியக்கவியல், உந்துவிசை, நிறை, எரிபொருள் மற்றும் மின்கல மதிப்புகளை இங்கே உள்ளிடுங்கள்.',
    '/physics': 'இது இயற்பியல் முடிவுகள் பக்கம். தூரம், தாங்கும் நேரம், ஏற்ற விகிதம், காற்றியக்க செயல்திறன் மற்றும் பாதுகாப்பு மதிப்பீட்டை காட்டுகிறது.',
    '/ml': 'இது இயந்திரக் கற்றல் கணிப்புப் பக்கம். எக்ஸ் ஜி பூஸ்ட் மாதிரி கணிப்புகள், நம்பிக்கை வரம்புகள் மற்றும் அம்ச விளைவுகளை காட்டுகிறது.',
    '/dashboard': 'இது பறப்பு என்வலப் டாஷ்போர்டு. தூரம், தாங்கும் நேரம், காற்றியக்க செயல்திறன் மற்றும் வடிவமைப்பு மதிப்பெண்ணை ஒன்றாகக் காட்டுகிறது.',
    '/comparison': 'இது இயற்பியல் மற்றும் இயந்திரக் கற்றல் ஒப்பீட்டுப் பக்கம். உயரம் தவிர்ந்த அனைத்து செயல்திறன் மதிப்புகளின் வேறுபாட்டை காட்டுகிறது.',
    '/performance': 'இது செயல்திறன் பகுப்பாய்வுப் பக்கம். தூரம் மற்றும் தாங்கும் நேர உணர்திறன் மற்றும் மேம்பாட்டு பரிந்துரைகளை காட்டுகிறது.',
    '/uncertainty': 'இது நிச்சயமின்மை பகுப்பாய்வுப் பக்கம். நடைமுறை மாறுபாடு மற்றும் மாதிரி அறிவு நிச்சயமின்மையை தனித்தனியாக காட்டுகிறது.',
    '/mission': 'இது மிஷன் திட்டமிடல் பக்கம். வரைபடத்தில் வழிப்புள்ளிகளை வைத்து நிலப்பரப்பு சார்ந்த பாதுகாப்பான பயண உயரம், ஆற்றல் மற்றும் காலத்தை கணக்கிடுங்கள்.',
    '/design-studio': 'இது வடிவமைப்பு அரங்கம். தானியங்கி வடிவமைப்பு தேடல் மற்றும் தோல்வி உருவகப்படுத்தல் இதில் உள்ளன.',
    '/report': 'இது அறிக்கை பக்கம். PDF அல்லது CSV பொறியியல் அறிக்கையை உருவாக்கி சேமித்த அமைப்புகளை நிர்வகிக்கலாம்.',
    '/command-center': 'இது மிஷன் கட்டுப்பாடு. நகரும் முப்பரிமாண தூரம் மற்றும் தாங்கும் நேர காட்சி, வடிவமைப்பு மதிப்பெண் மற்றும் நேரடி சரிசெய்தல் இதில் உள்ளன.',
    '/missions': 'இது உலக மிஷன் வரைபடம். ஒவ்வொரு சேமித்த மிஷனுக்கும் தனிப்பட்ட நகரும் விமானமும் பாதையும் உள்ளது.',
    '/feature-importance': 'இது அம்ச முக்கியத்துவம் மற்றும் மாதிரி ஒப்பீட்டுப் பக்கம். எக்ஸ் ஜி பூஸ்ட் அம்ச முக்கியத்துவம் மற்றும் சோதனை செயல்திறனை காட்டுகிறது.',
    '/sensitivity': 'இது உணர்திறன் பக்கம். உள்ளீடுகள் மாறும்போது செயல்திறன் முடிவுகள் எவ்வாறு மாறுகின்றன என்பதை காட்டுகிறது.',
    '/about': 'இது அறிமுகம் மற்றும் சூத்திரக் குறிப்பு பக்கம். தற்போதைய கணக்கீடுகள், கருதுகோள்கள் மற்றும் வரம்புகளை விளக்குகிறது.',
    default: 'இது UAV செயல்திறன் தளத்தின் ஒரு பக்கம். இது இயற்பியல் மற்றும் இயந்திரக் கற்றல் சார்ந்த வடிவமைப்பு பகுப்பாய்வு அமைப்பு.',
  },
};
