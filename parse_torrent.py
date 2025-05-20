#!/usr/bin/env python3
import sys
import hashlib
import os

# 간단한 bencode 라이브러리 구현
def bdecode(data):
    def decode_item(data, pos):
        ch = data[pos:pos+1].decode('ascii')
        
        if ch == 'd':  # 딕셔너리
            pos += 1
            result = {}
            while data[pos:pos+1] != b'e':
                key, pos = decode_item(data, pos)
                value, pos = decode_item(data, pos)
                result[key] = value
            return result, pos + 1
        elif ch == 'l':  # 리스트
            pos += 1
            result = []
            while data[pos:pos+1] != b'e':
                value, pos = decode_item(data, pos)
                result.append(value)
            return result, pos + 1
        elif ch == 'i':  # 정수
            pos += 1
            end = data.index(b'e', pos)
            value = int(data[pos:end].decode('ascii'))
            return value, end + 1
        elif ch.isdigit():  # 문자열
            # 콜론 위치 찾기
            colon = data.index(b':', pos)
            # 문자열 길이 계산
            length = int(data[pos:colon].decode('ascii'))
            # 문자열 추출
            str_start = colon + 1
            str_end = str_start + length
            return data[str_start:str_end], str_end
        else:
            raise ValueError(f"Unexpected character '{ch}' at position {pos}")
    
    # 디코딩 시작
    return decode_item(data, 0)[0]

# 토렌트 파일에서 info 딕셔너리 직접 추출
def extract_info_dict(data):
    # "4:info" 문자열 찾기
    info_pos = data.find(b'4:infod')
    if info_pos == -1:
        return None
    
    # info 딕셔너리 시작 위치 (d 문자 위치)
    dict_start = info_pos + len(b'4:info')
    
    # 균형 잡힌 딕셔너리 끝 찾기
    depth = 1
    dict_end = dict_start + 1
    
    while depth > 0 and dict_end < len(data):
        ch = chr(data[dict_end])
        if ch == 'd' or ch == 'l':
            depth += 1
        elif ch == 'e':
            depth -= 1
        dict_end += 1
    
    if depth == 0:
        # info 딕셔너리 추출 (d...e)
        info_dict = data[dict_start:dict_end]
        return info_dict
    
    return None

# 여러 범위를 테스트하여 목표 해시와 일치하는지 확인
def find_matching_hash(data, target_hash):
    info_pos = data.find(b'4:info')
    if info_pos == -1:
        return None
    
    print(f"'4:info' 패턴 발견 위치: {info_pos}")
    
    # 주변 범위에서 "d" 문자 찾기
    for dict_start in range(info_pos + len(b'4:info') - 5, info_pos + len(b'4:info') + 5):
        if dict_start < 0 or dict_start >= len(data):
            continue
        
        if chr(data[dict_start]) == 'd':
            print(f"딕셔너리 시작 후보: 위치 {dict_start}")
            
            # 균형 잡힌 딕셔너리 끝 찾기
            depth = 1
            dict_end = dict_start + 1
            
            while depth > 0 and dict_end < len(data):
                ch = chr(data[dict_end])
                if ch == 'd' or ch == 'l':
                    depth += 1
                elif ch == 'e':
                    depth -= 1
                dict_end += 1
            
            if depth == 0:
                # info 딕셔너리 추출 (d...e)
                info_dict = data[dict_start:dict_end]
                
                # SHA-1 해시 계산
                sha1 = hashlib.sha1(info_dict).hexdigest()
                print(f"범위 {dict_start}-{dict_end} ({len(info_dict)} 바이트): {sha1}")
                print(f"목표 해시와 일치 여부: {sha1 == target_hash}")
                
                # 작은 범위 조정을 통한 추가 테스트
                for offset_start in range(-3, 4):
                    for offset_end in range(-3, 4):
                        if offset_start == 0 and offset_end == 0:
                            continue  # 이미 테스트한 범위
                        
                        adjusted_start = dict_start + offset_start
                        adjusted_end = dict_end + offset_end
                        
                        if adjusted_start < 0 or adjusted_end > len(data) or adjusted_start >= adjusted_end:
                            continue
                        
                        adjusted_dict = data[adjusted_start:adjusted_end]
                        adjusted_sha1 = hashlib.sha1(adjusted_dict).hexdigest()
                        
                        if adjusted_sha1 == target_hash:
                            print(f"\n\n!!! 목표 해시 일치 발견 !!!")
                            print(f"범위 {adjusted_start}-{adjusted_end} (오프셋: {offset_start},{offset_end}): {adjusted_sha1}")
                            return (adjusted_start, adjusted_end, adjusted_dict)
    
    return None

# 토렌트 파일 분석
def analyze_torrent_file(file_path):
    # 목표 Info Hash
    target_hash = 'b054121e4f55682d8487b6e98bfc33a6420d609e'
    
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
        
        print(f"토렌트 파일 크기: {len(data)} 바이트")
        
        # 1. bencode 파싱 시도
        try:
            print("\n1. bencode 파싱:")
            torrent = bdecode(data)
            
            # 파싱된 구조 확인
            for key in torrent:
                if isinstance(key, bytes):
                    key_str = key.decode('utf-8', errors='replace')
                else:
                    key_str = str(key)
                print(f"- {key_str}: {type(torrent[key])}")
            
            # info 딕셔너리가 있는지 확인
            info_key = b'info'
            if info_key in torrent:
                print("\ninfo 딕셔너리 내용:")
                for key in torrent[info_key]:
                    if isinstance(key, bytes):
                        key_str = key.decode('utf-8', errors='replace')
                    else:
                        key_str = str(key)
                    print(f"- {key_str}: {type(torrent[info_key][key])}")
            else:
                print("info 딕셔너리가 없습니다.")
        except Exception as e:
            print(f"bencode 파싱 오류: {e}")
        
        # 2. 직접 추출
        print("\n2. 직접 info 딕셔너리 추출:")
        info_dict = extract_info_dict(data)
        
        if info_dict:
            info_hash = hashlib.sha1(info_dict).hexdigest()
            print(f"추출된 info 딕셔너리 크기: {len(info_dict)} 바이트")
            print(f"계산된 Info Hash: {info_hash}")
            print(f"목표 해시와 일치 여부: {info_hash == target_hash}")
        else:
            print("info 딕셔너리를 찾을 수 없습니다.")
        
        # 3. 여러 범위 테스트
        print("\n3. 여러 범위 테스트:")
        match_result = find_matching_hash(data, target_hash)
        
        if match_result:
            start, end, info_dict = match_result
            # 일치하는 info 딕셔너리 저장
            with open('matching_info_dict.bin', 'wb') as f:
                f.write(info_dict)
            print(f"일치하는 info 딕셔너리를 matching_info_dict.bin 파일로 저장했습니다.")
            return True
        else:
            print("\n목표 해시와 일치하는 info 딕셔너리를 찾을 수 없었습니다.")
            return False
            
    except Exception as e:
        print(f"오류 발생: {e}")
        return False

if __name__ == "__main__":
    torrent_file = 'sample_torrent/Forager.v4.1.8-GOG.torrent'
    
    if os.path.exists(torrent_file):
        analyze_torrent_file(torrent_file)
    else:
        print(f"파일을 찾을 수 없습니다: {torrent_file}") 