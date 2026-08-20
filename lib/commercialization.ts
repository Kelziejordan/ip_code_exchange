export type CommercializationResult = {
  summary: string;
  monetizableComponents: string[];
  licensingPaths: string[];
  valuation: number;
  riskScore: number;
  comparableMarkets: string[];
  buyers: {name:string;segment:string;website:string|null;fitScore:number;reason:string}[];
  outreach: {subject:string;body:string}[];
};

function fallback(input:{name:string;description:string;type:string}):CommercializationResult{
  const text = `${input.name} ${input.description}`.toLowerCase();
  const ai = /ai|agent|llm|model|automation/.test(text);
  const saas = /saas|software|app|platform|api/.test(text);
  const components = ["Core implementation/IP", "Reusable technical components", "Documentation and know-how", ...(ai?["AI/automation capability"]:[])];
  const licensingPaths = ["Non-exclusive license", "White-label licensing", "Royalty-based license", ...(saas?["SaaS commercialization"]:[]), "Acquisition / assignment"];
  const valuation = Math.round((components.length*5000 + licensingPaths.length*2500)*.7);
  return {summary:`${input.name} appears commercially relevant as ${input.type} with identifiable reusable IP and multiple paths to licensing or acquisition. This is a screening estimate, not a formal appraisal.`,monetizableComponents:components,licensingPaths,valuation,riskScore:.3,comparableMarkets:ai?["AI tooling","automation platforms","developer infrastructure"]:["B2B software","developer tools","specialized technology"],buyers:[{name:"AI product companies",segment:"AI / software",website:null,fitScore:.86,reason:"Potential need for reusable technology or differentiated capability."},{name:"SaaS vendors",segment:"SaaS",website:null,fitScore:.79,reason:"Potential fit for integration, white-labeling, or feature acquisition."},{name:"Strategic technology buyers",segment:"Technology",website:null,fitScore:.72,reason:"Potential fit where the IP shortens product development."}],outreach:[{subject:`Potential licensing opportunity: ${input.name}`,body:`I’m reaching out regarding a technology asset called ${input.name}. We believe it may have a fit with your product or roadmap. Would you be open to reviewing a short commercialization brief?`},{subject:`Follow-up: ${input.name}`,body:`Following up on the potential fit for ${input.name}. We can provide a concise technical and licensing summary if useful.`}]};
}

export async function commercialize(input:{name:string;description:string;type:string}):Promise<CommercializationResult>{
  if(!process.env.OPENAI_API_KEY) return fallback(input);
  const OpenAI=(await import("openai")).default;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`You are an IP commercialization engine. Analyze this asset and return ONLY valid JSON with keys summary, monetizableComponents, licensingPaths, valuation, riskScore, comparableMarkets, buyers, outreach. buyers must be an array of {name,segment,website,fitScore,reason}; outreach an array of {subject,body}. Do not invent private contact details. Clearly treat valuation as an estimate. Asset name: ${input.name}; type: ${input.type}; description: ${input.description}`;
  const r=await client.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4o-mini",messages:[{role:"user",content:prompt}],response_format:{type:"json_object"}});
  const raw=r.choices[0]?.message?.content||"{}";
  return JSON.parse(raw) as CommercializationResult;
}
