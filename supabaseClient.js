// 기본적으로 테스트 모드를 사용하여 로그인 우회 모드 설정
let testMode = true;
let supabase = null;

// Supabase URL과 API 키 (브라우저에서 접근 가능한 방식으로 설정)
// index.html에서 직접 전역 변수로 설정하거나 여기서 하드코딩할 수 있습니다.
// 보안상 민감한 키는 CLIENT_KEY(anon/public)만 사용해야 합니다.
let supabaseUrl = window.SUPABASE_URL || '';
let supabaseKey = window.SUPABASE_KEY || '';

// window에 supabase 객체가 존재하는지 확인
if (typeof supabaseClient === 'undefined' && window.supabase) {
  window.supabaseClient = window.supabase;
}

// 실제 Supabase 초기화 시도
function initializeSupabase(url, key) {
  // 파라미터가 제공된 경우 업데이트
  if (url) supabaseUrl = url;
  if (key) supabaseKey = key;
  
  console.log('Supabase 초기화 요청 받음');
  console.log('URL 제공됨:', !!url);
  console.log('키 제공됨:', !!key);
  
  if (supabaseUrl && supabaseKey) {
    try {
      console.log('Supabase 초기화 시작...');
      console.log('URL 확인:', supabaseUrl.substring(0, 10) + '...');
      console.log('키 존재 여부:', !!supabaseKey);
      
      // CDN UMD 버전에서는 `supabase` 객체를 확인
      if (window.supabase) {
        console.log('supabase 전역 객체 감지됨, 클라이언트 생성 시도');
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        testMode = false;
        console.log('Supabase 클라이언트가 성공적으로 초기화되었습니다.');
        return true;
      } else {
        console.warn('Supabase CDN이 로드되지 않았습니다. 테스트 모드로 전환합니다.');
        testMode = true;
        return false;
      }
    } catch (error) {
      console.error('Supabase 클라이언트 초기화 오류:', error);
      testMode = true;
      return false;
    }
  } else {
    console.warn('Supabase URL 또는 키가 제공되지 않아 테스트 모드로 작동합니다.');
    console.warn('테스트 모드에서는 ID: admin / admin123 또는 admin01 / admin123으로 로그인할 수 있습니다.');
    testMode = true;
    return false;
  }
}

// 로그가 로드된 후 초기화 시도
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded 이벤트 발생, Supabase 초기화 예약');
  
  setTimeout(() => {
    console.log('지연된 Supabase 초기화 시도');
    initializeSupabase();
  }, 1000);
});

// User ID를 기반으로 가상 이메일 주소 생성 함수
function generateVirtualEmail(userId) {
  return `${userId}@torrentpeertrackertemp.com`;
}

// 로그인 상태 확인 함수
async function checkUserSession() {
  // 로컬 스토리지에서 토큰 확인
  const token = localStorage.getItem('supabase.auth.token');
  if (token && token.startsWith('test-token')) {
    console.log('테스트 토큰이 감지됨, 테스트 사용자 반환');
    return { id: 'admin-id', email: 'admin@torrentpeertrackertemp.com' };
  }

  if (!supabase) {
    if (testMode) {
      // 테스트 모드에서는 항상 로그인된 상태로 간주
      console.log('테스트 모드: 세션 확인 요청, 테스트 사용자 반환');
      return { id: 'test-user-id', email: 'admin@torrentpeertrackertemp.com' };
    }
    console.warn('Supabase 클라이언트가 초기화되지 않았습니다. 로그인되지 않은 상태로 반환합니다.');
    return null;
  }

  try {
    console.log('Supabase에서 사용자 세션 확인 요청 중...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Supabase 사용자 세션 결과:', user ? '로그인됨' : '로그인되지 않음');
    return user;
  } catch (error) {
    console.error('사용자 세션 확인 오류:', error);
    return null;
  }
}

// 로그아웃 함수
async function signOut() {
  // 로컬 스토리지에서 토큰 확인 및 제거
  const token = localStorage.getItem('supabase.auth.token');
  if (token && token.startsWith('test-token')) {
    console.log('테스트 토큰 감지, 로컬 스토리지에서 토큰 제거');
    localStorage.removeItem('supabase.auth.token');
    return { error: null };
  }

  if (!supabase) {
    if (testMode) {
      // 테스트 모드에서는 로그아웃 시뮬레이션
      console.log('테스트 모드: 로그아웃 시뮬레이션');
      localStorage.removeItem('supabase.auth.token');
      return { error: null };
    }
    console.warn('Supabase 클라이언트가 초기화되지 않았습니다. 로컬 토큰만 제거합니다.');
    localStorage.removeItem('supabase.auth.token');
    return { error: null };
  }

  try {
    console.log('Supabase에 로그아웃 요청 중...');
    const { error } = await supabase.auth.signOut();
    
    // 로컬 토큰 항상 제거
    localStorage.removeItem('supabase.auth.token');
    
    return { error };
  } catch (error) {
    console.error('로그아웃 오류:', error);
    // 오류가 있어도 로컬 토큰 제거
    localStorage.removeItem('supabase.auth.token');
    return { error };
  }
}

// User ID와 비밀번호로 로그인 함수
async function signInWithUserId(userId, password) {
  // 항상 Supabase 인증을 먼저 시도
  if (supabase) {
    try {
      console.log('Supabase에 로그인 요청 중...');
      const email = generateVirtualEmail(userId);
      console.log(`사용자 ID ${userId}로 ${email} 생성하여 로그인 시도`);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Supabase 로그인 오류:', error);
        // Supabase 로그인 실패 시에만 테스트 모드로 대체
        if (testMode) {
          return tryTestModeLogin(userId, password);
        }
        return { data: null, error };
      }
      
      // 로그인 성공 시 토큰 저장
      if (data && data.session && data.session.access_token) {
        console.log('Supabase 로그인 성공:', data.user.email);
        localStorage.setItem('supabase.auth.token', data.session.access_token);
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Supabase 로그인 처리 중 예외 발생:', error);
      if (testMode) {
        return tryTestModeLogin(userId, password);
      }
      return { data: null, error: { message: '로그인 처리 중 오류가 발생했습니다.' } };
    }
  } else if (testMode) {
    // Supabase가 없는 경우에만 테스트 모드로 로그인
    return tryTestModeLogin(userId, password);
  }

  return {
    data: null,
    error: { message: 'Supabase 클라이언트가 초기화되지 않았고 테스트 모드도 비활성화되었습니다.' }
  };
}

// 테스트 모드 로그인 함수
function tryTestModeLogin(userId, password) {
  console.log('테스트 모드: 로그인 시도', userId);
  
  // 허용된 테스트 계정들
  if ((userId === 'admin' && password === 'admin123') || 
      (userId === 'admin01' && password === 'admin123')) {
    
    console.log('테스트 모드: 로그인 성공');
    const testToken = 'test-token-' + Date.now();
    localStorage.setItem('supabase.auth.token', testToken);
    
    return {
      data: {
        user: { id: `${userId}-id`, email: generateVirtualEmail(userId) },
        session: { access_token: testToken }
      },
      error: null
    };
  }
  
  // 잘못된 자격 증명일 경우 로그인 실패 시뮬레이션
  console.log('테스트 모드: 로그인 실패');
  return {
    data: null,
    error: { message: '잘못된 사용자 ID 또는 비밀번호입니다.' }
  };
}

// 테스트 목적으로 사용할 수 있는 createUser 함수
async function createUser(userId, password) {
  if (!supabase) {
    return { error: { message: 'Supabase 클라이언트가 초기화되지 않았습니다.' } };
  }
  
  try {
    const email = generateVirtualEmail(userId);
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) {
      return { error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    return { error: { message: '사용자 생성 중 오류가 발생했습니다.' } };
  }
}

// 전역 Supabase 상태 확인 함수
function getSupabaseStatus() {
  return {
    initialized: !!supabase,
    testMode,
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  };
}

// 글로벌 객체로 내보내기
window.supabaseClient = {
  generateVirtualEmail,
  checkUserSession,
  signOut,
  signInWithUserId,
  createUser,
  initializeSupabase,
  getSupabaseStatus
}; 