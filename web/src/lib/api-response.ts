import { NextResponse } from 'next/server';

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(),
  });
}

export function jsonError(message: string, status = 400, code?: string) {
  const body: Record<string, string> = { status: 'error', message };
  if (code) body.code = code;
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Api-Key',
  };
}

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}