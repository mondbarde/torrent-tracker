const fs = require('fs');
const crypto = require('crypto');

const torrentFile = './sample_torrent/Forager.v4.1.8-GOG.torrent';

// 토렌트 파일 읽기
const torrentData = fs.readFileSync(torrentFile);
console.log(`토렌트 파일 크기: ${torrentData.length} 바이트`);

// 헥스 덤프로 출력 (디버깅용)
console.log('파일 시작 100바이트:');
console.log(torrentData.slice(0, 100).toString('hex'));

/**
 * 문자열에서 패턴의 모든 위치를 찾는 함수
 */
function findAllOccurrences(buffer, pattern) {
    const positions = [];
    let pos = buffer.indexOf(pattern);
    
    while (pos !== -1) {
        positions.push(pos);
        pos = buffer.indexOf(pattern, pos + 1);
    }
    
    return positions;
}

// "4:info" 문자열 검색
const infoKeyword = Buffer.from('4:info');
const infoPositions = findAllOccurrences(torrentData, infoKeyword);

console.log(`"4:info" 키워드 발견 위치: ${infoPositions.join(', ')}`);

// 각 위치에서 실제 info 딕셔너리 추출 시도
const possibleInfoDicts = [];

for (const pos of infoPositions) {
    // "4:info" 다음 바이트 확인
    const afterKeyword = pos + infoKeyword.length;
    
    // info 키워드 다음에 'd'가 와야 함 (딕셔너리 시작)
    if (torrentData[afterKeyword] === 100) { // 'd' ASCII 코드
        console.log(`위치 ${pos}에서 유효한 "info" 키 발견, 딕셔너리는 ${afterKeyword}에서 시작`);
        
        // 균형 맞는 딕셔너리 찾기
        let depth = 1; // 'd'로 시작했으므로 1
        let endPos = afterKeyword + 1;
        
        while (depth > 0 && endPos < torrentData.length) {
            const byte = torrentData[endPos];
            
            if (byte === 100 || byte === 108) { // 'd' 또는 'l'
                depth++;
            } else if (byte === 101) { // 'e'
                depth--;
            }
            
            endPos++;
        }
        
        if (depth === 0) {
            console.log(`딕셔너리 끝: ${endPos - 1} (길이: ${endPos - afterKeyword})`);
            
            // info 딕셔너리 추출
            const infoDict = torrentData.slice(afterKeyword, endPos);
            
            // SHA-1 해시 계산
            const hash = crypto.createHash('sha1').update(infoDict).digest('hex');
            console.log(`Info Hash: ${hash}`);
            
            possibleInfoDicts.push({
                start: afterKeyword,
                end: endPos,
                hash
            });
        }
    }
}

// 추출된 모든 가능한 info 딕셔너리 확인
console.log('\n모든 가능한 info 딕셔너리:');
possibleInfoDicts.forEach((info, index) => {
    console.log(`${index + 1}. 위치: ${info.start}-${info.end}, 해시: ${info.hash}`);
});

// 목표 해시 확인
const targetHash = 'b054121e4f55682d8487b6e98bfc33a6420d609e';
console.log(`\n목표 해시: ${targetHash}`);

// 목표 해시와 일치하는 결과 있는지 확인
const matchingInfo = possibleInfoDicts.find(info => info.hash === targetHash);

if (matchingInfo) {
    console.log(`목표 해시와 일치하는 info 딕셔너리 찾음! 위치: ${matchingInfo.start}-${matchingInfo.end}`);
    
    // 추출한 info 딕셔너리를 파일로 저장하여 검증
    fs.writeFileSync('extracted_info_dict.bin', torrentData.slice(matchingInfo.start, matchingInfo.end));
    console.log('추출한 info 딕셔너리를 extracted_info_dict.bin 파일로 저장했습니다.');
} else {
    console.log('목표 해시와 일치하는 info 딕셔너리를 찾을 수 없습니다.');
    
    // 추가 분석: 토렌트 파일을 수동으로 파싱
    console.log('\n수동 파싱 시도...');
    
    // bencode 문자열 분석
    let bencodeString = torrentData.toString('binary');
    let infoPos = bencodeString.indexOf('4:infod');
    
    if (infoPos !== -1) {
        console.log(`'4:infod' 찾음 (위치: ${infoPos})`);
        
        // 지정된 위치에서 info 딕셔너리 시작점 (d) 찾기
        const dictStart = infoPos + 6; // '4:info' 다음 위치
        
        if (bencodeString[dictStart] === 'd') {
            console.log(`info 딕셔너리 시작: ${dictStart}`);
            
            // 균형 잡힌 딕셔너리 끝 찾기
            let depth = 1;
            let i = dictStart + 1;
            
            while (depth > 0 && i < bencodeString.length) {
                if (bencodeString[i] === 'd' || bencodeString[i] === 'l') {
                    depth++;
                } else if (bencodeString[i] === 'e') {
                    depth--;
                }
                i++;
            }
            
            if (depth === 0) {
                console.log(`info 딕셔너리 끝: ${i - 1}`);
                
                // 딕셔너리 추출
                const manualInfoDict = Buffer.from(bencodeString.substring(dictStart, i), 'binary');
                const manualHash = crypto.createHash('sha1').update(manualInfoDict).digest('hex');
                
                console.log(`수동 추출 Info Hash: ${manualHash}`);
                console.log(`목표 해시와 일치: ${manualHash === targetHash}`);
                
                // 추출한 info 딕셔너리를 파일로 저장
                fs.writeFileSync('manual_info_dict.bin', manualInfoDict);
                console.log('수동 추출한 info 딕셔너리를 manual_info_dict.bin 파일로 저장했습니다.');
            }
        }
    }
} 