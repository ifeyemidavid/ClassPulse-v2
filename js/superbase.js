// ── SUPABASE CONFIG ─────────────────────────────────────────────
const SUPABASE_URL = 'https://cvrahbbusanrbilgumtw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_v1MwYd90vlZT_UiJ3TOIxA_IpEvGx0e'

// Load Supabase client
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── AUTH ────────────────────────────────────────────────────────

async function signUp(fullName, email, course, password) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, course }
    }
  })
  if (error) throw error

  // Save extra info to teachers table
  const { error: dbError } = await db
    .from('teachers')
    .insert({ full_name: fullName, email, course, id: data.user.id })
  if (dbError) throw dbError

  return data
}

async function logIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

async function logOut() {
  const { error } = await db.auth.signOut()
  if (error) throw error
  window.location.href = 'login.html'
}

async function getCurrentTeacher() {
  const { data: { user } } = await db.auth.getUser()
  return user
}

// ── SESSIONS ────────────────────────────────────────────────────

async function createSession(teacherId, title, course) {
  // Generate unique 6 digit room code
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data, error } = await db
    .from('sessions')
    .insert({ teacher_id: teacherId, title, course, room_code: roomCode })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getSessionByCode(roomCode) {
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .eq('is_active', true)
    .single()

  if (error) throw error
  return data
}

async function endSession(sessionId) {
  const { error } = await db
    .from('sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

  if (error) throw error
}

async function getTeacherSessions(teacherId) {
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ── QUESTIONS ───────────────────────────────────────────────────

async function saveQuestions(sessionId, questions) {
  const rows = questions.map((q, i) => ({
    session_id: sessionId,
    question_text: q.text,
    options: q.options,
    correct_index: q.correct,
    order_num: i
  }))

  const { data, error } = await db
    .from('questions')
    .insert(rows)
    .select()

  if (error) throw error
  return data
}

async function getSessionQuestions(sessionId) {
  const { data, error } = await db
    .from('questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_num')

  if (error) throw error
  return data
}

// ── STUDENTS ────────────────────────────────────────────────────

async function joinSession(sessionId, studentName) {
  const { data, error } = await db
    .from('students')
    .insert({ session_id: sessionId, name: studentName })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getSessionStudents(sessionId) {
  const { data, error } = await db
    .from('students')
    .select('*')
    .eq('session_id', sessionId)

  if (error) throw error
  return data
}

// ── ANSWERS ─────────────────────────────────────────────────────

async function submitAnswer(sessionId, studentId, questionId, selectedIndex, isCorrect, confusion) {
  const { data, error } = await db
    .from('answers')
    .insert({
      session_id: sessionId,
      student_id: studentId,
      question_id: questionId,
      selected_index: selectedIndex,
      is_correct: isCorrect,
      confusion: confusion
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getSessionAnswers(sessionId) {
  const { data, error } = await db
    .from('answers')
    .select('*, students(name), questions(question_text, correct_index)')
    .eq('session_id', sessionId)

  if (error) throw error
  return data
}

// ── REALTIME ────────────────────────────────────────────────────

function watchAnswers(sessionId, callback) {
  return db
    .channel('answers-' + sessionId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'answers',
      filter: 'session_id=eq.' + sessionId
    }, callback)
    .subscribe()
}

function watchStudents(sessionId, callback) {
  return db
    .channel('students-' + sessionId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'students',
      filter: 'session_id=eq.' + sessionId
    }, callback)
    .subscribe()
}

function watchSession(sessionId, callback) {
  return db
    .channel('session-' + sessionId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sessions',
      filter: 'id=eq.' + sessionId
    }, callback)
    .subscribe()
}