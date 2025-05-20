// server.js - Node.js 백엔드 서버 코드

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { DHT } = require('bittorrent-dht');
const Client = require('bittorrent-tracker');
const geoip = require('geoip-lite');
const dns = require('dns').promises;

const app = express();
const port = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());

// 토렌트 피어 검색 API 엔드포인트
app.post('/api/peers/search', async (req, res) => {
  try {
    const { infoHash } = req.body;
    
    // Info Hash 유효성 검사
    if (!infoHash || !/^[a-fA-F0-9]{40}$/i.test(infoHash)) {
      return res.status(400).json({ error: '유효한 Info Hash가 필요합니다 (40자 16진수)' });
    }
    
    // 검색 결과를 저장할 객체
    const results = {
      infoHash,
      timestamp: new Date().toISOString(),
      trackerResponses: [],
      dhtResponses: 0,
      peerList: [],
      totalPeers: 0,
      uniqueIPs: 0
    };
    
    // 병렬로 DHT와 트래커 검색 실행
    const [dhtPeers, trackerPeers] = await Promise.all([
      searchDHT(infoHash),
      searchTrackers(infoHash)
    ]);
    
    // DHT 결과 처리
    results.dhtResponses = dhtPeers.length;
    for (const peer of dhtPeers) {
      const geoData = geoip.lookup(peer.ip) || { country: 'Unknown', city: '', region: '' };
      let isp = 'Unknown';
      
      try {
        // IP 주소의 DNS 역방향 조회로 ISP 추정
        const hostnames = await dns.reverse(peer.ip);
        if (hostnames && hostnames.length > 0) {
          isp = hostnames[0].split('.').slice(-2).join('.');
        }
      } catch (err) {
        // DNS 조회 실패 시 기본값 사용
      }
      
      results.peerList.push({
        ip: peer.ip,
        port: peer.port,
        source: 'DHT',
        country: geoData.country || 'Unknown',
        isp
      });
    }
    
    // 트래커 결과 처리
    for (const trackerResult of trackerPeers) {
      results.trackerResponses.push({
        tracker: trackerResult.tracker,
        peers: trackerResult.peers.length,
        seeders: trackerResult.response.complete || 0,
        leechers: trackerResult.response.incomplete || 0
      });
      
      for (const peer of trackerResult.peers) {
        const geoData = geoip.lookup(peer.ip) || { country: 'Unknown', city: '', region: '' };
        let isp = 'Unknown';
        
        try {
          const hostnames = await dns.reverse(peer.ip);
          if (hostnames && hostnames.length > 0) {
            isp = hostnames[0].split('.').slice(-2).join('.');
          }
        } catch (err) {
          // DNS 조회 실패 시 기본값 사용
        }
        
        results.peerList.push({
          ip: peer.ip,
          port: peer.port,
          source: 'Tracker',
          country: geoData.country || 'Unknown',
          isp
        });
      }
    }
    
    // 중복 IP 제거 및 통계 계산
    const uniqueIPs = new Set(results.peerList.map(peer => peer.ip));
    results.totalPeers = results.peerList.length;
    results.uniqueIPs = uniqueIPs.size;
    
    res.json(results);
  } catch (error) {
    console.error('피어 검색 에러:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

// DHT 네트워크에서 피어 검색 함수
async function searchDHT(infoHash) {
  return new Promise((resolve, reject) => {
    const dht = new DHT();
    const peers = [];
    const timeout = setTimeout(() => {
      dht.destroy();
      resolve(peers);
    }, 30000); // 30초 타임아웃
    
    dht.on('error', (err) => {
      console.error('DHT 에러:', err);
    });
    
    dht.on('peer', (peer, infoHashBuffer, from) => {
      peers.push({
        ip: peer.host || peer.address,
        port: peer.port
      });
    });
    
    dht.on('ready', () => {
      // Buffer로 변환
      const buffer = Buffer.from(infoHash, 'hex');
      dht.lookup(buffer);
    });
  });
}

// 트래커에서 피어 검색 함수
async function searchTrackers(infoHash) {
  // 일반적인 퍼블릭 트래커 목록
  const trackers = [
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.openbittorrent.com:6969',
    'udp://tracker.leechers-paradise.org:6969',
    'udp://exodus.desync.com:6969',
    'udp://9.rarbg.to:2710'
  ];
  
  const results = [];
  
  for (const tracker of trackers) {
    try {
      const peers = await queryTracker(infoHash, tracker);
      if (peers.peers.length > 0) {
        results.push(peers);
      }
    } catch (err) {
      console.error(`트래커 ${tracker} 쿼리 실패:`, err);
    }
  }
  
  return results;
}

// 단일 트래커 쿼리 함수
function queryTracker(infoHash, trackerUrl) {
  return new Promise((resolve, reject) => {
    const peerId = Buffer.from('01234567890123456789');
    const port = 6881;
    
    const client = new Client({
      infoHash: Buffer.from(infoHash, 'hex'),
      peerId,
      announce: [trackerUrl],
      port
    });
    
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('트래커 타임아웃'));
    }, 15000); // 15초 타임아웃
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.destroy();
      reject(err);
    });
    
    client.on('update', (response) => {
      clearTimeout(timeout);
      
      const peers = [];
      if (response.peers) {
        for (const peer of response.peers) {
          peers.push({
            ip: peer.ip,
            port: peer.port
          });
        }
      }
      
      client.destroy();
      resolve({
        tracker: trackerUrl,
        response,
        peers
      });
    });
    
    client.start();
  });
}

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});
