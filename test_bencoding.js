const fs = require('fs');
const crypto = require('crypto');
const bencode = require('bencoding');

const torrentFile = './sample_torrent/Forager.v4.1.8-GOG.torrent';
// 목표 해시 전역으로 선언
const targetHash = 'b054121e4f55682d8487b6e98bfc33a6420d609e';

// 토렌트 파일 읽기
const torrentBuffer = fs.readFileSync(torrentFile);
console.log(`토렌트 파일 크기: ${torrentBuffer.length} 바이트`);

try {
    // 전체 토렌트 파일 파싱
    const torrentData = bencode.decode(torrentBuffer);
    console.log('토렌트 파일 기본 구조:');
    
    // 토렌트 파일 구조 확인
    Object.keys(torrentData).forEach(key => {
        const value = torrentData[key];
        console.log(`${key}: ${typeof value}`);
    });
    
    // info 딕셔너리가 있는지 확인
    if (torrentData.info) {
        console.log('\nInfo 딕셔너리 내용:');
        Object.keys(torrentData.info).forEach(key => {
            console.log(`${key}: ${typeof torrentData.info[key]}`);
        });
        
        // info 딕셔너리만 다시 bencode로 인코딩
        const infoEncoded = bencode.encode(torrentData.info);
        
        // info 딕셔너리의 SHA-1 해시 계산
        const hash = crypto.createHash('sha1').update(infoEncoded).digest('hex');
        console.log(`\nbencoding 라이브러리로 계산한 Info Hash: ${hash}`);
        
        console.log(`목표 해시: ${targetHash}`);
        console.log(`해시 일치 여부: ${hash === targetHash}`);
        
        // 인코딩된 info 딕셔너리 저장
        fs.writeFileSync('bencoding_info_dict.bin', infoEncoded);
        console.log('인코딩된 info 딕셔너리를 bencoding_info_dict.bin 파일로 저장했습니다.');
    } else {
        console.error('토렌트 파일에 info 딕셔너리가 없습니다.');
    }
    
    // 원본 데이터에서 'info' 딕셔너리 위치 찾기
    console.log('\ninfo 딕셔너리 위치 찾기...');
    
    // '4:info' 문자열 검색
    const infoKey = '4:info';
    const data = torrentBuffer.toString();
    const infoPos = data.indexOf(infoKey);
    
    if (infoPos !== -1) {
        console.log(`'4:info' 키워드 발견 위치: ${infoPos}`);
        
        // info 키 다음에 나오는 값이 딕셔너리인지 확인
        const valueStart = infoPos + infoKey.length;
        
        if (data[valueStart] === 'd') {
            console.log(`info 딕셔너리 시작: 위치 ${valueStart}`);
            
            // 중첩된 벤코딩 구조 분석을 위한 깊이 추적
            let depth = 1;
            let i = valueStart + 1;
            
            while (depth > 0 && i < data.length) {
                if (data[i] === 'd' || data[i] === 'l') {
                    depth++;
                } else if (data[i] === 'e') {
                    depth--;
                }
                i++;
            }
            
            if (depth === 0) {
                console.log(`info 딕셔너리 끝: 위치 ${i - 1}`);
                
                // 추출된 딕셔너리에 대한 SHA-1 해시 계산
                const infoDict = torrentBuffer.slice(valueStart, i);
                const hash = crypto.createHash('sha1').update(infoDict).digest('hex');
                
                console.log(`직접 추출된 info 딕셔너리 해시: ${hash}`);
                console.log(`목표 해시와 일치 여부: ${hash === targetHash}`);
                
                // 직접 추출한 info 딕셔너리 저장
                fs.writeFileSync('extracted_info_dict.bin', infoDict);
                console.log('추출된 info 딕셔너리를 extracted_info_dict.bin 파일로 저장했습니다.');
                
                // 다양한 오프셋을 시도해보기
                console.log('\n다양한 오프셋으로 시도:');
                for (let offset = -3; offset <= 3; offset++) {
                    if (offset === 0) continue; // 이미 계산한 결과
                    
                    const adjustedStart = valueStart + (offset < 0 ? offset : 0);
                    const adjustedEnd = i + (offset > 0 ? offset : 0);
                    
                    if (adjustedStart >= 0 && adjustedEnd <= torrentBuffer.length) {
                        const adjustedDict = torrentBuffer.slice(adjustedStart, adjustedEnd);
                        const adjustedHash = crypto.createHash('sha1').update(adjustedDict).digest('hex');
                        
                        console.log(`오프셋 ${offset}: 해시 = ${adjustedHash}`);
                        console.log(`목표 해시와 일치 여부: ${adjustedHash === targetHash}`);
                        
                        if (adjustedHash === targetHash) {
                            fs.writeFileSync(`matched_info_dict_offset_${offset}.bin`, adjustedDict);
                            console.log(`일치하는 info 딕셔너리를 matched_info_dict_offset_${offset}.bin 파일로 저장했습니다.`);
                        }
                    }
                }
            }
        }
    }

    // 단순 시도: info 딕셔너리를 직접 파일에서 추출
    const binaryData = torrentBuffer.toString('binary');
    const startMarker = '4:infod';
    const startPos = binaryData.indexOf(startMarker);
    
    if (startPos !== -1) {
        // 'infod' 다음 위치가 info 딕셔너리의 시작
        const dictStart = startPos + 'info'.length + 1; // +1 for 'd' after info
        
        // 나머지 딕셔너리를 찾기 위한 균형 잡힌 ')'와 'd' 중첩 깊이 추적
        let depth = 1;
        let endPos = dictStart + 1;
        
        while (depth > 0 && endPos < binaryData.length) {
            const char = binaryData[endPos];
            if (char === 'd' || char === 'l') depth++;
            else if (char === 'e') depth--;
            endPos++;
        }
        
        if (depth === 0) {
            console.log(`\n단순 방법으로 찾은 info 딕셔너리: ${dictStart - 1} ~ ${endPos - 1}`);
            
            // 다양한 범위 시도
            for (let start = dictStart - 2; start <= dictStart; start++) {
                for (let end = endPos - 1; end <= endPos + 1; end++) {
                    const slice = Buffer.from(binaryData.substring(start, end), 'binary');
                    const hash = crypto.createHash('sha1').update(slice).digest('hex');
                    
                    console.log(`범위 ${start}:${end} - 해시: ${hash}`);
                    console.log(`목표 해시와 일치 여부: ${hash === targetHash}`);
                    
                    if (hash === targetHash) {
                        fs.writeFileSync(`exact_match_${start}_${end}.bin`, slice);
                        console.log(`일치하는 info 딕셔너리를 exact_match_${start}_${end}.bin 파일로 저장했습니다.`);
                    }
                }
            }
        }
    }
} catch (error) {
    console.error('토렌트 파일 분석 중 오류 발생:', error);
} 