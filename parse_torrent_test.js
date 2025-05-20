const fs = require('fs');
const parseTorrent = require('parse-torrent');
const bencode = require('bencode');
const crypto = require('crypto');

const torrentFile = './sample_torrent/Forager.v4.1.8-GOG.torrent';
const targetHash = 'b054121e4f55682d8487b6e98bfc33a6420d609e';

async function main() {
    try {
        console.log('1. parse-torrent 라이브러리 사용:');
        const torrentData = await parseTorrent(fs.readFileSync(torrentFile));
        console.log(`토렌트 파일: ${torrentData.name}`);
        console.log(`Info Hash: ${torrentData.infoHash}`);
        console.log(`목표 해시와 일치 여부: ${torrentData.infoHash === targetHash}`);
        
        console.log('\n2. bencode 라이브러리 사용:');
        // 토렌트 파일 읽기
        const torrentBuffer = fs.readFileSync(torrentFile);
        const parsed = bencode.decode(torrentBuffer);
        
        // info 딕셔너리 추출 및 해시 계산
        if (parsed.info) {
            const infoEncoded = bencode.encode(parsed.info);
            const hash = crypto.createHash('sha1').update(infoEncoded).digest('hex');
            console.log(`bencode 라이브러리로 계산한 Info Hash: ${hash}`);
            console.log(`목표 해시와 일치 여부: ${hash === targetHash}`);
        } else {
            console.log('bencode 파싱 결과에 info 딕셔너리가 없습니다.');
        }
        
        // 3. raw bencode를 바로 해시로 변환
        const rawBencodeInfoHash = parseTorrent.toInfoHash(torrentBuffer);
        console.log('\n3. 직접 raw 파일에서 해시로 변환:');
        console.log(`Raw Info Hash: ${rawBencodeInfoHash}`);
        console.log(`목표 해시와 일치 여부: ${rawBencodeInfoHash === targetHash}`);
        
        // 4. 모든 데이터 로깅
        console.log('\n4. 토렌트 메타데이터 상세 내용:');
        const detailedInfo = parseTorrent(torrentBuffer);
        
        Object.keys(detailedInfo).forEach(key => {
            if (key !== 'pieces' && key !== 'info' && key !== 'raw') {
                console.log(`${key}: ${JSON.stringify(detailedInfo[key])}`);
            }
        });
        
        // 5. WebTorrent 방식으로 테스트
        console.log('\n5. 수동으로 Info Hash 계산 (WebTorrent 방식):');
        function calculateInfoHash(torrent) {
            const info = bencode.decode(torrentBuffer).info;
            if (!info) throw new Error('Invalid torrent: no info dictionary');
            const infoBuffer = bencode.encode(info);
            return crypto.createHash('sha1').update(infoBuffer).digest('hex');
        }
        
        const manualInfoHash = calculateInfoHash(torrentBuffer);
        console.log(`수동 계산 Info Hash: ${manualInfoHash}`);
        console.log(`목표 해시와 일치 여부: ${manualInfoHash === targetHash}`);
        
        // 6. 바이트 단위로 검사하여 정확한 위치 찾기
        console.log('\n6. 바이트 단위 분석:');
        // 일반적인 토렌트 파일에서 info 딕셔너리 위치 찾기
        const torrentStr = torrentBuffer.toString('binary');
        const infoStr = '4:info';
        const infoPos = torrentStr.indexOf(infoStr);
        
        if (infoPos !== -1) {
            console.log(`'4:info' 문자열 위치: ${infoPos}`);
            
            // 이 위치 이후의 첫 번째 'd'가 info 딕셔너리의 시작
            const dictStart = infoPos + infoStr.length;
            if (torrentStr[dictStart] === 'd') {
                console.log(`info 딕셔너리 시작 위치: ${dictStart}`);
                
                // 딕셔너리의 균형 잡힌 끝을 찾음
                let depth = 1;
                let dictEnd = dictStart + 1;
                
                while (depth > 0 && dictEnd < torrentStr.length) {
                    const char = torrentStr[dictEnd];
                    if (char === 'd' || char === 'l') depth++;
                    else if (char === 'e') depth--;
                    dictEnd++;
                }
                
                // 부분 버퍼 추출 (딕셔너리 자체만)
                const infoDict = Buffer.from(torrentStr.substring(dictStart, dictEnd), 'binary');
                const infoHash = crypto.createHash('sha1').update(infoDict).digest('hex');
                
                console.log(`추출된 바이너리 info 딕셔너리 길이: ${infoDict.length} 바이트`);
                console.log(`계산된 Info Hash: ${infoHash}`);
                console.log(`목표 해시와 일치 여부: ${infoHash === targetHash}`);
                
                // 검증: info 딕셔너리가 제대로 추출되었는지 확인
                try {
                    const decodedDict = bencode.decode(infoDict);
                    console.log('디코딩된 info 딕셔너리 구조:');
                    Object.keys(decodedDict).forEach(key => {
                        console.log(`- ${key}: ${typeof decodedDict[key]}`);
                    });
                } catch (err) {
                    console.log('info 딕셔너리 디코딩 실패:', err.message);
                }
                
                // 7. BEP-0003 명세에 따른 직접 계산
                console.log('\n7. BEP-0003 명세에 따른 계산:');
                const parsedTorrent = bencode.decode(torrentBuffer);
                if (parsedTorrent && parsedTorrent.info) {
                    const infoBuf = bencode.encode(parsedTorrent.info);
                    const bepInfoHash = crypto.createHash('sha1').update(infoBuf).digest('hex');
                    console.log(`BEP-0003 방식 Info Hash: ${bepInfoHash}`);
                    console.log(`목표 해시와 일치 여부: ${bepInfoHash === targetHash}`);
                    
                    // 토렌트의 원본 키 순서가 중요할 수 있음
                    console.log('\ninfo 딕셔너리 원본 키 순서:');
                    const keys = Object.keys(parsedTorrent.info);
                    console.log(keys.join(', '));
                }
            }
        }
    } catch (error) {
        console.error('오류 발생:', error);
    }
}

main().then(() => console.log('분석 완료.')); 