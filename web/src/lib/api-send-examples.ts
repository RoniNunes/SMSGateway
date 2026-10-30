export type ApiSendExampleTab =
  | 'get'
  | 'curl'
  | 'curl-header'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'php'
  | 'ruby'
  | 'csharp'
  | 'kotlin';

export type CountryDialOption = {
  code: string;
  label: string;
};

export const API_COUNTRY_CODES: CountryDialOption[] = [
  { code: '+34', label: 'España (+34)' },
  { code: '+55', label: 'Brasil (+55)' },
  { code: '+52', label: 'México (+52)' },
  { code: '+54', label: 'Argentina (+54)' },
  { code: '+56', label: 'Chile (+56)' },
  { code: '+57', label: 'Colombia (+57)' },
  { code: '+51', label: 'Perú (+51)' },
  { code: '+1', label: 'Estados Unidos / Canadá (+1)' },
  { code: '+44', label: 'Reino Unido (+44)' },
  { code: '+33', label: 'Francia (+33)' },
  { code: '+49', label: 'Alemania (+49)' },
  { code: '+39', label: 'Italia (+39)' },
  { code: '+351', label: 'Portugal (+351)' },
  { code: '+31', label: 'Países Bajos (+31)' },
  { code: '+32', label: 'Bélgica (+32)' },
  { code: '+41', label: 'Suiza (+41)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+81', label: 'Japón (+81)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+91', label: 'India (+91)' },
];

export const API_SEND_EXAMPLE_TABS: { id: ApiSendExampleTab; label: string }[] = [
  { id: 'get', label: 'GET' },
  { id: 'curl', label: 'cURL' },
  { id: 'curl-header', label: 'cURL + header' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'csharp', label: 'C#' },
];

const PLACEHOLDER_PHONE = '+SEU_NUMERO_DESTINO';
const MIN_LOCAL_DIGITS = 8;

/** Remove espaços e qualquer carácter que não seja dígito. */
export function sanitizePhoneDigits(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/\D/g, '');
}

export function normalizeCountryCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '+34';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function buildFullDestPhone(countryCode: string, localDigits: string): string {
  const digits = sanitizePhoneDigits(localDigits);
  if (!digits) return '';
  return `${normalizeCountryCode(countryCode)}${digits}`;
}

export function isValidDestPhone(localDigits: string): boolean {
  return sanitizePhoneDigits(localDigits).length >= MIN_LOCAL_DIGITS;
}

function pyStr(s: string): string {
  return JSON.stringify(s);
}

export function buildSendExamples(params: {
  apiBase: string;
  apiPath: string;
  apiKey: string;
  phone: string;
  msg: string;
  hasValidPhone: boolean;
}): Record<ApiSendExampleTab, string> {
  const { apiBase, apiPath, apiKey, msg, hasValidPhone } = params;
  const phone = hasValidPhone ? params.phone : PLACEHOLDER_PHONE;
  const endpoint = `${apiBase}${apiPath}`;
  const encodedPhone = encodeURIComponent(phone);
  const encodedMsg = encodeURIComponent(msg);

  return {
    get: `${endpoint}?action=send&api_key=${apiKey}&phone=${encodedPhone}&msg=${encodedMsg}`,
    curl: `curl -G "${endpoint}" \\\n  --data-urlencode "action=send" \\\n  --data-urlencode "api_key=${apiKey}" \\\n  --data-urlencode "phone=${phone}" \\\n  --data-urlencode "msg=${msg}"`,
    'curl-header': `curl -X POST "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}" \\\n  -H "X-Api-Key: ${apiKey}"`,
    javascript: `const res = await fetch(\n  "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}",\n  { headers: { "X-Api-Key": "${apiKey}" } }\n);\nconst data = await res.json();\nconsole.log(data);`,
    typescript: `const res = await fetch(\n  "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}",\n  { headers: { "X-Api-Key": "${apiKey}" } }\n);\nconst data = (await res.json()) as { status: string; id: number };\nconsole.log(data);`,
    python: `import requests\n\nr = requests.get("${endpoint}", params={\n    "action": "send",\n    "api_key": "${apiKey}",\n    "phone": ${pyStr(phone)},\n    "msg": ${pyStr(msg)},\n})\nprint(r.json())`,
    go: `package main\n\nimport (\n  "fmt"\n  "net/http"\n  "net/url"\n)\n\nfunc main() {\n  base := "${endpoint}"\n  q := url.Values{}\n  q.Set("action", "send")\n  q.Set("api_key", "${apiKey}")\n  q.Set("phone", ${pyStr(phone)})\n  q.Set("msg", ${pyStr(msg)})\n  resp, err := http.Get(base + "?" + q.Encode())\n  if err != nil { panic(err) }\n  defer resp.Body.Close()\n  fmt.Println(resp.Status)\n}`,
    rust: `use reqwest::Url;\n\n#[tokio::main]\nasync fn main() -> Result<(), reqwest::Error> {\n    let url = Url::parse_with_params(\n        "${endpoint}",\n        &[\n            ("action", "send"),\n            ("api_key", "${apiKey}"),\n            ("phone", ${pyStr(phone)}),\n            ("msg", ${pyStr(msg)}),\n        ],\n    )?;\n    let res = reqwest::Client::new()\n        .get(url)\n        .header("X-Api-Key", "${apiKey}")\n        .send()\n        .await?;\n    println!("{:?}", res.json::<serde_json::Value>().await?);\n    Ok(())\n}`,
    java: `import java.net.URI;\nimport java.net.http.*;\n\npublic class SendSms {\n  public static void main(String[] args) throws Exception {\n    String url = "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}";\n    HttpRequest req = HttpRequest.newBuilder(URI.create(url))\n      .header("X-Api-Key", "${apiKey}")\n      .GET()\n      .build();\n    HttpResponse<String> res = HttpClient.newHttpClient()\n      .send(req, HttpResponse.BodyHandlers.ofString());\n    System.out.println(res.body());\n  }\n}`,
    kotlin: `import java.net.URI\nimport java.net.http.HttpClient\nimport java.net.http.HttpRequest\nimport java.net.http.HttpResponse\n\nfun main() {\n    val url = "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}"\n    val req = HttpRequest.newBuilder(URI.create(url))\n        .header("X-Api-Key", "${apiKey}")\n        .GET()\n        .build()\n    val res = HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString())\n    println(res.body())\n}`,
    php: `<?php\n$endpoint = "${endpoint}";\n$query = http_build_query([\n    'action' => 'send',\n    'api_key' => '${apiKey}',\n    'phone' => ${pyStr(phone)},\n    'msg' => ${pyStr(msg)},\n]);\n$response = file_get_contents($endpoint . '?' . $query);\necho $response;\n`,
    ruby: `require "net/http"\nrequire "uri"\n\nuri = URI("${endpoint}")\nuri.query = URI.encode_www_form(\n  action: "send",\n  api_key: "${apiKey}",\n  phone: ${pyStr(phone)},\n  msg: ${pyStr(msg)},\n)\nres = Net::HTTP.get_response(uri)\nputs res.body`,
    csharp: `using var client = new HttpClient();\nclient.DefaultRequestHeaders.Add("X-Api-Key", "${apiKey}");\nvar url = "${endpoint}?action=send&phone=${encodedPhone}&msg=${encodedMsg}";\nvar json = await client.GetStringAsync(url);\nConsole.WriteLine(json);`,
  };
}

export { MIN_LOCAL_DIGITS, PLACEHOLDER_PHONE };