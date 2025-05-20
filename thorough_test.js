const fs = require('fs');
const crypto = require('crypto');

const torrentFile = './sample_torrent/Forager.v4.1.8-GOG.torrent';
const targetHash = 'b054121e4f55682d8487b6e98bfc33a6420d609e';

// 토렌트 파일 읽기
const torrentBuffer = fs.readFileSync(torrentFile);
console.log(`토렌트 파일 크기: ${torrentBuffer.length} 바이트`);

// 바이너리 데이터에서 "4:info" 패턴 찾기
const pattern = [52, 58, 105, 110, 102, 111]; // "4:info"의 ASCII 값

// 패턴 위치 찾기
function findPatternPosition(buffer, pattern) {
    for (let i = 0; i <= buffer.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (buffer[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            return i;
        }
    }
    return -1;
}

const infoPos = findPatternPosition(torrentBuffer, pattern);

if (infoPos !== -1) {
    console.log(`"4:info" 패턴 발견 위치: ${infoPos}`);
    
    // 넓은 범위에서 시작점과 끝점을 모두 테스트
    console.log('\n더 넓은 범위에서 info 딕셔너리 추출 시도...');
    
    // info 패턴 이후 예상 범위 설정
    const startOffset = infoPos + pattern.length; // "4:info" 직후
    
    // 예상 시작 범위에서 30바이트 앞뒤로 테스트
    const startRange = 50;
    // 파일 끝까지 테스트 (딕셔너리 크기를 모름)
    const maxEndOffset = Math.min(torrentBuffer.length, startOffset + 10000);
    
    // 가능한 모든 해시 저장
    const allHashes = new Set();
    let matchFound = false;
    
    // 광범위한 시작 범위 테스트
    for (let start = Math.max(0, startOffset - startRange); start <= startOffset + startRange && !matchFound; start++) {
        // d(딕셔너리 시작)부터 시작하는지 확인 (시작점 더 정확히 찾기)
        if (torrentBuffer[start] === 100) { // 'd'의 ASCII 코드
            console.log(`딕셔너리 시작 후보: 위치 ${start}`);
            
            // 균형 잡힌 딕셔너리 찾기
            let startDepth = 1; // 'd'부터 시작했으므로
            
            // 다양한 종료 지점 테스트
            for (let end = start + 1; end < maxEndOffset && !matchFound; end++) {
                const byte = torrentBuffer[end];
                
                if (byte === 100 || byte === 108) { // 'd' 또는 'l'
                    startDepth++;
                } else if (byte === 101) { // 'e'
                    startDepth--;
                    
                    // 균형이 맞았을 때 딕셔너리 완료
                    if (startDepth === 0) {
                        // 이 위치에서 딕셔너리가 완료됨
                        const dictionary = torrentBuffer.slice(start, end + 1); // 'd'부터 'e'까지
                        const hash = crypto.createHash('sha1').update(dictionary).digest('hex');
                        
                        // 중복 방지를 위해 이미 계산한 해시는 건너뜀
                        if (!allHashes.has(hash)) {
                            allHashes.add(hash);
                            
                            console.log(`범위 [${start}-${end + 1}] (${end - start + 1}바이트) - 해시: ${hash}`);
                            console.log(`목표 해시와 일치 여부: ${hash === targetHash}`);
                            
                            if (hash === targetHash) {
                                console.log(`\n!!! 목표 해시 일치 발견 !!!`);
                                console.log(`시작: ${start}, 끝: ${end + 1}, 길이: ${end - start + 1} 바이트`);
                                fs.writeFileSync('matched_info_dict.bin', dictionary);
                                console.log('일치하는 info 딕셔너리를 matched_info_dict.bin 파일로 저장했습니다.');
                                
                                matchFound = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    if (!matchFound) {
        console.log('\n목표 해시와 일치하는 info 딕셔너리를 찾을 수 없었습니다.');
        console.log(`테스트한 고유 해시 개수: ${allHashes.size}`);
    }
} else {
    console.log('"4:info" 패턴을 찾을 수 없습니다.');
} 