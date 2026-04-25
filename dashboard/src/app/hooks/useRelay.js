'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { x25519 } from '@noble/curves/ed25519.js';

const Handshake = {
  generateKeyPair: () => {
    const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
    const publicKey = x25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
  },

  deriveSharedSecret: (privateKey, publicKey) => {
    return x25519.getSharedSecret(privateKey, publicKey);
  },

  encrypt: async (key, payload) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw', key, 'AES-GCM', false, ['encrypt']
    );
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, cryptoKey, payload
    );
    const fullBuffer = new Uint8Array(encrypted);
    const ciphertext = fullBuffer.slice(0, -16);
    const tag = fullBuffer.slice(-16);
    return {
      ciphertext: Buffer.from(ciphertext),
      iv: Buffer.from(iv),
      tag: Buffer.from(tag)
    };
  },

  decrypt: async (key, iv, tag, ciphertext) => {
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw', key, 'AES-GCM', false, ['decrypt']
    );
    const fullCiphertext = new Uint8Array(ciphertext.length + tag.length);
    fullCiphertext.set(new Uint8Array(ciphertext), 0);
    fullCiphertext.set(new Uint8Array(tag), ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, cryptoKey, fullCiphertext
    );
    return Buffer.from(decrypted);
  }
};

export function useRelay() {
  const [status, setStatus] = useState('disconnected');
  const [lastError, setLastError] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);
  const ephemeral = useRef(null);
  // Ref mirrors the sharedSecret state so onmessage always reads the live
  // value without needing sharedSecret in connect's dependency array.
  const sharedSecretRef = useRef(null);
  const GATEWAY_ID = 'dan-nucbox';

  const setSecret = useCallback((secret) => {
    sharedSecretRef.current = secret;
    setSharedSecret(secret);
  }, []);

  const connect = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_RELAY_URL;
    if (!url) {
      setLastError('Relay URL not configured');
      setStatus('error');
      return;
    }

    setStatus('connecting');

    try {
      const wsUrl = `${url}?type=consumer&id=${GATEWAY_ID}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setStatus('connected');
        setLastError(null);
      };

      ws.current.onmessage = async (event) => {
        try {
          const text = event.data instanceof Blob ? await event.data.text() : event.data;
          const data = JSON.parse(text);

          switch (data.type) {
            case 'consumer_connected':
              break;

            case 'hs_step1':
              console.log('[Dashboard] Received handshake step 1 from bridge');
              const bridgePub = Buffer.from(data.pub, 'hex');
              ephemeral.current = Handshake.generateKeyPair();
              const secret = Handshake.deriveSharedSecret(ephemeral.current.privateKey, bridgePub);
              setSecret(secret);
              ws.current.send(JSON.stringify({
                type: 'hs_step2',
                pub: Buffer.from(ephemeral.current.publicKey).toString('hex')
              }));
              break;

            case 'hs_step3':
              console.log('[Dashboard] Handshake complete. Bridge verified.');
              break;

            case 'encrypted_message':
              if (!sharedSecretRef.current) return;
              try {
                const decrypted = await Handshake.decrypt(
                    sharedSecretRef.current,
                    Buffer.from(data.iv, 'hex'),
                    Buffer.from(data.tag, 'hex'),
                    Buffer.from(data.ciphertext, 'hex')
                );
                const payload = JSON.parse(decrypted.toString());
                setMessages(prev => [...prev, payload]);
              } catch (e) {
                  console.error('[Dashboard] Decryption failed', e);
              }
              break;

            case 'pairing_initiated':
            case 'pairing_complete':
              setMessages(prev => [...prev, data]);
              break;
          }
        } catch (e) {
          console.error('Failed to parse relay message', e);
        }
      };

      ws.current.onclose = () => {
        setStatus('disconnected');
        setSecret(null);
        setTimeout(connect, 5000);
      };

      ws.current.onerror = () => {
        setLastError('WebSocket error occurred');
        setStatus('error');
      };
    } catch (e) {
      setLastError(e.message);
      setStatus('error');
    }
  }, [setSecret]);

  const sendEncrypted = useCallback(async (payload) => {
    if (!ws.current || !sharedSecretRef.current) return;
    const encrypted = await Handshake.encrypt(sharedSecretRef.current, Buffer.from(JSON.stringify(payload)));
    ws.current.send(JSON.stringify({
      type: 'encrypted_message',
      ciphertext: encrypted.ciphertext.toString('hex'),
      iv: encrypted.iv.toString('hex'),
      tag: encrypted.tag.toString('hex')
    }));
  }, []);

  const send = useCallback((payload) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify(payload));
      }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  return { status, gateways: [{id: GATEWAY_ID, status: sharedSecret ? 'online' : 'connecting'}], lastError, sharedSecret, messages, sendEncrypted, send };
}
