import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function upstreamOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const base = raw?.replace(/\/$/, '');
  if (!base) {
    throw new Error('Set NEXT_PUBLIC_API_URL to your Nest server origin (e.g. http://localhost:4500)');
  }
  return base;
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<Response> {
  const path = pathSegments.filter(Boolean).join('/');
  const search = request.nextUrl.search;
  const url = `${upstreamOrigin()}/api/v1/${path}${search}`;

  const { getToken } = await auth();
  const token = await getToken();

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  const accept = request.headers.get('accept');
  if (accept) {
    headers.set('Accept', accept);
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = request.method;
  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      body = buf;
    }
  }

  const upstream = await fetch(url, {
    method,
    headers,
    body: body ?? null,
  });

  const outHeaders = new Headers(upstream.headers);
  const ct = upstream.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    outHeaders.set('Cache-Control', 'private, no-store');
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function HEAD(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function POST(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function PUT(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}
