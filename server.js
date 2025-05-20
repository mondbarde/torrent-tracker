const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const DHT = require('bittorrent-dht');
const Tracker = require('bittorrent-tracker');
const geoip = require('geoip-lite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

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

app.post('/api/search', async (req, res) => {
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