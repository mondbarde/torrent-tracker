const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const DHT = require('bittorrent-dht');
const Tracker = require('bittorrent-tracker');
const geoip = require('geoip-lite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
// .env.local 파일에서 환경 변수 로드
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;

// Supabase 클라이언트 초기화
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase 클라이언트가 성공적으로 초기화되었습니다.');
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 오류:', error);
  }
} else {
  console.warn('Supabase URL 또는 키가 제공되지 않아 인증 기능이 비활성화되었습니다.');
  if (!supabaseUrl) console.warn('SUPABASE_URL이 설정되지 않았습니다.');
  if (!supabaseKey) console.warn('SUPABASE_KEY 또는 SUPABASE_SERVICE_KEY가 설정되지 않았습니다.');
}

app.use(cors());
app.use(bodyParser.json());

// JWT 인증 미들웨어
const authenticateUser = async (req, res, next) => {
  // Supabase 클라이언트가 없을 경우 인증 우회
  if (!supabase) {
    console.warn('인증이 비활성화됨: Supabase 클라이언트가 초기화되지 않았습니다.');
    req.user = { id: 'anonymous', email: 'anonymous@torrentpeertrackertemp.com' };
    return next();
  }

  const authHeader = req.headers.authorization;
  
  // 테스트 토큰 처리
  if (authHeader && authHeader.startsWith('Bearer test-token')) {
    console.log('테스트 토큰 사용 감지됨, 테스트 사용자로 인증합니다.');
    req.user = { id: 'admin-id', email: 'admin@torrentpeertrackertemp.com' };
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    console.log('토큰 검증 시도...');
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('토큰 검증 실패:', error?.message || '사용자 정보 없음');
      return res.status(401).json({ error: '유효하지 않은 인증 토큰입니다' });
    }
    
    console.log('토큰 검증 성공:', data.user.email);
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: '인증 오류가 발생했습니다' });
  }
};

// DHT 인스턴스 생성
const dht = new DHT();

// 정적 파일 제공
app.use(express.static('.'));

// 임시 파일 경로
const PEERS_FILE = path.join(__dirname, 'temp_peers.json');

// 피어 데이터 파일에 저장
function savePeerToFile(peerToSave) {
  try {
    let peers = [];
    if (fs.existsSync(PEERS_FILE)) {
      const data = fs.readFileSync(PEERS_FILE, 'utf8');
      if (data) {
        peers = JSON.parse(data);
      }
    }
    peers.push(peerToSave);
    fs.writeFileSync(PEERS_FILE, JSON.stringify(peers, null, 2));
    console.log(`Peer saved to file: ${peerToSave.ip}:${peerToSave.port}`);
  } catch (err) {
    console.error('Error saving peer to file:', err);
  }
}

// 파일에서 피어 데이터 로드
function loadPeersFromFile() {
  try {
    if (fs.existsSync(PEERS_FILE)) {
      const data = fs.readFileSync(PEERS_FILE, 'utf8');
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (err) {
    console.error('Error loading peers from file:', err);
  }
  return [];
}

// 임시 파일 삭제
function clearPeersFile() {
  try {
    if (fs.existsSync(PEERS_FILE)) {
      fs.unlinkSync(PEERS_FILE);
      console.log('Cleared peers file');
    }
  } catch (err) {
    console.error('Error clearing peers file:', err);
  }
}

// API 요청에 인증 미들웨어 적용
app.post('/api/search', authenticateUser, async (req, res) => {
  console.log('Received search request:', req.body);
  const { infoHash } = req.body;
  
  if (!infoHash) {
    console.log('Error: Info hash is missing');
    return res.status(400).json({ error: 'Info hash is required' });
  }

  try {
    console.log('Searching for peers with info hash:', infoHash);
    
    // 임시 파일 초기화
    clearPeersFile();
    
    // DHT 검색
    try {
      console.log('Starting DHT lookup...');
      await new Promise((resolve) => {
        dht.lookup(infoHash, (err, dhtPeers) => {
          if (err) {
            console.error('DHT lookup error:', err);
            resolve();
            return;
          }
          
          if (!dhtPeers || !Array.isArray(dhtPeers)) {
            console.log('No peers found from DHT');
            resolve();
            return;
          }

          console.log('DHT peers found:', dhtPeers.length);
          dhtPeers.forEach(dhtPeer => {
            if (dhtPeer && dhtPeer.host && dhtPeer.port) {
              const peerData = {
                ip: dhtPeer.host,
                port: dhtPeer.port
              };
              savePeerToFile(peerData);
            }
          });
          resolve();
        });
      });
      
    } catch (err) {
      console.error('DHT search error:', err);
    }

    // Tracker 검색 설정
    console.log('Starting tracker search...');
    const client = new Tracker.Client({
      infoHash: Buffer.from(infoHash, 'hex'),
      peerId: crypto.randomBytes(20),
      port: 6881,
      announce: [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://tracker.internetwarriors.net:1337/announce',
        'udp://exodus.desync.com:6969/announce'
      ]
    });

    let peerCount = 0;

    // Peer 이벤트 핸들러
    client.on('peer', function(peerAddrString) {
      console.log('Peer event triggered (raw address string):', peerAddrString);
      if (typeof peerAddrString === 'string') {
        const parts = peerAddrString.split(':');
        if (parts.length === 2) {
          const host = parts[0];
          const port = parseInt(parts[1], 10);
          if (host && !isNaN(port)) {
            peerCount++;
            console.log(`Parsed tracker peer: ${host}:${port}, 총 ${peerCount}개`);
            savePeerToFile({
              ip: host,
              port: port
            });
          } else {
            console.warn('Failed to parse peer address string:', peerAddrString);
          }
        } else {
          console.warn('Unexpected peer address string format:', peerAddrString);
        }
      } else {
        console.warn('Unexpected peer event data type:', peerAddrString);
      }
    });

    // 오류 및 경고 이벤트 핸들러
    client.on('error', function(err) {
      console.error('Tracker client error:', err.message);
    });

    client.on('warning', function(err) {
      console.warn('Tracker client warning:', err.message);
    });

    client.on('update', function(data) {
      console.log('Tracker update received:', data);
    });

    // Tracker 시작
    console.log('Starting tracker client...');
    client.start();

    // 15초 동안 대기한 후 peer 데이터 반환
    console.log('Waiting for peers for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Tracker 중지
    console.log('Stopping tracker client...');
    client.stop();
    client.destroy(); // 클라이언트 완전 제거
    
    // 파일에서 피어 데이터 로드
    const collectedPeers = loadPeersFromFile();
    console.log(`Total peers found before deduplication: ${collectedPeers.length}`);
    console.log('모든 수집된 peers:', JSON.stringify(collectedPeers, null, 2));
    
    // 중복 제거 및 지리 정보 추가
    const uniquePeers = [];
    const peerKeys = new Set();
    
    for (const peer of collectedPeers) {
      const key = `${peer.ip}:${peer.port}`;
      if (!peerKeys.has(key)) {
        peerKeys.add(key);
        
        const location = geoip.lookup(peer.ip);
        uniquePeers.push({
          ip: peer.ip,
          port: peer.port,
          country: location ? location.country : 'Unknown',
          city: location ? location.city : 'Unknown',
          latitude: location && location.ll ? location.ll[0] : null,
          longitude: location && location.ll ? location.ll[1] : null
        });
      }
    }
    
    console.log(`Total unique peers found: ${uniquePeers.length}`);
    if (uniquePeers.length > 0) {
      console.log('Sample peer:', uniquePeers[0]);
    }
    
    // 최종 결과 반환
    console.log('Sending response with peers:', uniquePeers);
    res.json(uniquePeers);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Failed to fetch peers', details: error.message });
  }
});

// 인증 엔드포인트 - 테스트용 (실제로는 Supabase가 직접 처리)
app.post('/api/verify-session', async (req, res) => {
  const { token } = req.body;
  
  // 테스트 토큰 처리
  if (token && token.startsWith('test-token')) {
    console.log('테스트 토큰으로 세션 확인');
    return res.json({ 
      valid: true, 
      user: { id: 'admin-id', email: 'admin@torrentpeertrackertemp.com' } 
    });
  }
  
  // Supabase 클라이언트가 없을 경우 인증 우회
  if (!supabase) {
    console.warn('인증이 비활성화됨: Supabase 클라이언트가 초기화되지 않았습니다.');
    return res.json({ 
      valid: true, 
      user: { id: 'anonymous', email: 'anonymous@torrentpeertrackertemp.com' } 
    });
  }
  
  if (!token) {
    return res.status(400).json({ error: '토큰이 필요합니다' });
  }
  
  try {
    console.log('토큰으로 세션 검증 시도:', token.substring(0, 10) + '...');
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('세션 검증 실패:', error?.message || '사용자 정보 없음');
      return res.status(401).json({ valid: false, error: '유효하지 않은 세션입니다' });
    }
    
    console.log('세션 검증 성공:', data.user.email);
    return res.json({ valid: true, user: data.user });
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({ valid: false, error: '세션 검증 중 오류가 발생했습니다' });
  }
});

// 서버 설정 라우트 - 클라이언트에게 필요한 환경 변수 제공
app.get('/api/config', (req, res) => {
  // 클라이언트에게 필요한 설정만 전달 (민감한 정보는 제외)
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || '',  // 클라이언트용 anon 키만 전달
  });
});

// favicon.ico 요청 처리
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 404 에러 핸들링
app.use((req, res) => {
  console.log('404 Not Found:', req.url);
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 