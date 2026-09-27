import { createHash } from 'node:crypto';
import { ApiError } from './errors.mjs';

export function normaliseLoginEmail(input) {
  const email=typeof input==='string'?input.trim().toLowerCase():'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError(400,'invalid_login_email','Enter a valid email address.');
  return email;
}

// The public proxy also limits requests per client. This second, bounded guard
// limits repeated lookups of the same address without retaining the address.
export function createLoginDiscoveryLimit(now=()=>Date.now()) {
  const attempts=new Map();
  return email=>{
    const time=now();
    const key=createHash('sha256').update(email).digest('hex');
    if(attempts.size>4096)for(const [id,entry] of attempts)if(entry.until<=time)attempts.delete(id);
    const entry=attempts.get(key);
    if(entry&&entry.until>time&&entry.count>=8)
      throw new ApiError(429,'login_lookup_limited','Please wait before trying this address again.');
    attempts.set(key,entry&&entry.until>time?{count:entry.count+1,until:entry.until}:{count:1,until:time+300000});
  };
}
