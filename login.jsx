// React를 전역 변수로 사용
const { useState } = React;
const { Shield, Lock, User, AlertCircle } = lucide;

function LoginPage() {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // window.supabaseClient에서 함수 호출
      const { data, error } = await window.supabaseClient.signInWithUserId(userId, password)
      
      if (error) {
        console.error('Login error:', error)
        setError(error.message)
      } else {
        // 로그인 성공 시 페이지 리로드하여 메인 앱 페이지로 이동
        window.location.reload()
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('로그인 처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-800 p-3 rounded-full">
            <Shield className="h-10 w-10 text-white" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          토렌트 트래커 서비스
        </h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              사용자 ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="userId"
                name="userId"
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="관리자 ID 입력"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="비밀번호 입력"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>이 서비스는 인증된 직원만 접근 가능합니다.</p>
          <p className="mt-1">ID가 없는 경우 관리자에게 문의하세요.</p>
        </div>
      </div>
    </div>
  )
}

// 전역 스코프에 노출
window.LoginPage = LoginPage; 