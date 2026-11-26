import { describe, expect, it } from 'vitest';
import { joinUrl, validName, validPort } from '../../../src/ui/lobby';

describe('lobby form boundaries', () => {
  it.each(['A',' Искорка ','a'.repeat(24)])('accepts name %s', name => expect(validName(name)).toBe(true));
  it.each(['','   ','a'.repeat(25),'a\nb','a\u0000'])('rejects name %s', name => expect(validName(name)).toBe(false));
  it.each(['1','43127','65535'])('accepts port %s', port => expect(validPort(port)).toBe(true));
  it.each(['','0','65536','1.1','-1','1e3',' 43127'])('rejects port %s', port => expect(validPort(port)).toBe(false));
  it.each([['192.168.0.2','ws://192.168.0.2:43127'],['[::1]','ws://[::1]:43127'],['::1','ws://[::1]:43127'],['host.local:1234','ws://host.local:1234'],['ws://host.local:1234/','ws://host.local:1234']])('normalizes %s', (address, expected) => expect(joinUrl(address,'43127')).toBe(expected));
  it.each(['999.1.1.1','127.1','001.1.1.1','https://host','ws://a@b','a/b','a?b','host:0','host:65536','-host','a..b','a b','[:::1]'])('rejects %s', address => expect(joinUrl(address,'43127')).toBeNull());
});
