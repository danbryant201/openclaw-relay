import { useState, useEffect, useCallback, useRef } from 'react';
import { Handshake } from '../../../shared/crypto/Handshake.js';

export function useRelay() {
  const [status, setStatus] = useState('disconnected');
  const [gateways, setGateways] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [messages, setMessages] = useState([]); // Decrypted inbox
  const ws = useRef(null);
  const ephemeral = useRef(null);

  const connect = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_RELAY_URL;
    if (!url) {
      setLastError('Relay URL not configured');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setStatus('connected');
        setLastError(null);
        ws.current.send(JSON.stringify({ type: 'identify', role: 'dashboard' }));
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'registry_update':
              setGateways(data.gateways || []);
              break;

            case 'provider_connected':
              // Start Handshake Step 1
              ephemeral.current = Handshake.generateKeyPair();
              ws.current.send(JSON.stringify({
                type: 'hs_step1',
                pub: Buffer.from(ephemeral.current.publicKey).toString('hex')
              }));
              break;

            case 'hs_step2':
              // Bridge responded with its ephemeral pub
              const bridgePub = Buffer.from(data.pub, 'hex');
              const secret = Handshake.deriveSharedSecret(ephemeral.current.privateKey, bridgePub);
              setSharedSecret(secret);
              console.log('[Dashboard] E2EE Handshake Complete');
              break;

            case 'encrypted_message':
              if (!sharedSecret) {
                  // Fallback: If we get an encrypted message before secret is set, 
                  // it might be a race condition or plain relay message
                  setMessages(prev => [...prev, data]);
                  return;
              }
              try {
                const decrypted = Handshake.decrypt(
                    sharedSecret,
                    Buffer.from(data.iv, 'hex'),
                    Buffer.from(data.tag, 'hex'),
                    Buffer.from(data.ciphertext, 'hex')
                );
                const payload = JSON.parse(decrypted.toString());
                setMessages(prev => [...prev, payload]);
              } catch (e) {
                  // If decryption fails, it might be a plaintext message from the relay
                  setMessages(prev => [...prev, data]);
              }
              break;
            
            // Handle plain relay messages
            case 'pairing_code_generated':
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
        setSharedSecret(null);
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
  }, [sharedSecret]);

  const sendEncrypted = useCallback((payload) => {
    if (!ws.current || !sharedSecret) return;
    
    const encrypted = Handshake.encrypt(sharedSecret, Buffer.from(JSON.stringify(payload)));
    ws.current.send(JSON.stringify({
      type: 'encrypted_message',
      ciphertext: encrypted.ciphertext.toString('hex'),
      iv: encrypted.iv.toString('hex'),
      tag: encrypted.tag.toString('hex')
    }));
  }, [sharedSecret]);

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

  return { status, gateways, lastError, sharedSecret, messages, sendEncrypted, send };
}
