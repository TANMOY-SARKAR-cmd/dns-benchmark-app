import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dgram from 'dgram';
import dnsPacket from 'dns-packet';
import { DnsProxyServer, startDnsProxy, getDnsProxy } from './dnsProxy';
import { DNS_PROVIDERS } from './dns';

// Mock dgram
vi.mock('dgram', () => {
  const mockSocket = {
    on: vi.fn(),
    bind: vi.fn((port, host, callback) => callback && callback()),
    send: vi.fn(),
    close: vi.fn((callback) => callback && callback()),
  };
  return {
    default: {
      createSocket: vi.fn(() => mockSocket),
    },
  };
});

describe('DnsProxyServer', () => {
  let proxy: DnsProxyServer;
  let mockServer: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    proxy = new DnsProxyServer({ port: 5353, cacheTtl: 60 });
    await proxy.start();
    mockServer = dgram.createSocket('udp4');
  });

  afterEach(async () => {
    await proxy.stop();
  });

  it('should start and bind to the correct port', () => {
    expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
    expect(mockServer.bind).toHaveBeenCalledWith(5353, '127.0.0.1', expect.any(Function));
  });

  it('should handle incoming DNS query and forward to upstream', async () => {
    // Create a mock DNS query packet
    const queryBuffer = dnsPacket.encode({
      type: 'query',
      id: 1234,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{
        type: 'A',
        name: 'google.com',
        class: 'IN'
      }]
    });

    const rinfo = { address: '127.0.0.1', family: 'IPv4', port: 12345, size: queryBuffer.length };

    // Get the message handler registered by the proxy
    const messageHandler = mockServer.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Trigger the message handler
    await messageHandler(queryBuffer, rinfo);

    // Wait for async handler
    await new Promise(process.nextTick);

    // Verify a new socket was created for the upstream query (1 for proxy, 1 for upstream query)
    expect(dgram.createSocket).toHaveBeenCalledTimes(2);

    // Get the upstream socket
    const upstreamSocket = (dgram.createSocket as any).mock.results[1].value;

    // Verify the query was sent to the upstream provider
    expect(upstreamSocket.send).toHaveBeenCalledWith(
      queryBuffer,
      0,
      queryBuffer.length,
      53,
      DNS_PROVIDERS['Google DNS'],
      expect.any(Function)
    );
  });

  it('should return upstream response to client and cache it', async () => {
    const queryBuffer = dnsPacket.encode({
      type: 'query',
      id: 1234,
      questions: [{ type: 'A', name: 'google.com' }]
    });
    const rinfo = { address: '127.0.0.1', port: 12345 };

    const responseBuffer = dnsPacket.encode({
      type: 'response',
      id: 1234,
      questions: [{ type: 'A', name: 'google.com' }],
      answers: [{ type: 'A', class: 'IN', name: 'google.com', ttl: 300, data: '142.250.190.46' }]
    });

    const messageHandler = mockServer.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Trigger query
    await messageHandler(queryBuffer, rinfo);

    await new Promise(process.nextTick);

    const upstreamSocket = (dgram.createSocket as any).mock.results[1].value;
    const upstreamMessageHandler = upstreamSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Simulate upstream response
    await upstreamMessageHandler(responseBuffer);

    // Verify response sent to client
    expect(mockServer.send).toHaveBeenCalledWith(
      responseBuffer,
      0,
      responseBuffer.length,
      12345,
      '127.0.0.1'
    );

    // Verify cache hit on second query
    const queryBuffer2 = dnsPacket.encode({
      type: 'query',
      id: 5678, // Different ID
      questions: [{ type: 'A', name: 'google.com' }]
    });

    mockServer.send.mockClear();
    upstreamSocket.send.mockClear();

    await messageHandler(queryBuffer2, rinfo);

    // Should not send to upstream again
    expect(upstreamSocket.send).not.toHaveBeenCalled();

    // Should send cached response with updated ID
    expect(mockServer.send).toHaveBeenCalled();
    const sentBuffer = mockServer.send.mock.calls[0][0];
    const sentPacket = dnsPacket.decode(sentBuffer);
    expect(sentPacket.id).toBe(5678); // ID should be updated
    expect(sentPacket.answers).toBeDefined();
    expect(sentPacket.answers![0].data).toBe('142.250.190.46');

    const stats = proxy.getStats();
    expect(stats.cached).toBe(1);
  });

  it('should return SERVFAIL on upstream error', async () => {
    const queryBuffer = dnsPacket.encode({
      type: 'query',
      id: 1234,
      questions: [{ type: 'A', name: 'error.com' }]
    });
    const rinfo = { address: '127.0.0.1', port: 12345 };

    const messageHandler = mockServer.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Trigger query
    await messageHandler(queryBuffer, rinfo);

    const upstreamSocket = (dgram.createSocket as any).mock.results[1].value;
    const upstreamErrorHandler = upstreamSocket.on.mock.calls.find((call: any[]) => call[0] === 'error')[1];

    // Simulate upstream error
    await upstreamErrorHandler(new Error('Network error'));

    // Verify SERVFAIL response sent to client
    expect(mockServer.send).toHaveBeenCalled();
    const sentBuffer = mockServer.send.mock.calls[0][0];
    const sentPacket = dnsPacket.decode(sentBuffer);
    expect(sentPacket.id).toBe(1234);
    expect(sentPacket.flags & 2).toBe(2);
  });
});
