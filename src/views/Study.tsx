import CardsPanel from '../components/CardsPanel'
import QuizPanel from '../components/QuizPanel'

export function FlashcardsView() {
  return (
    <section className="view" aria-labelledby="fc-title">
      <h1 id="fc-title">Flashcards</h1>
      <p className="sb">Flip, recall, repeat.</p>
      <div className="gl dense hero"><CardsPanel withChips /></div>
    </section>
  )
}

export function QuizzesView() {
  return (
    <section className="view" aria-labelledby="qz-title">
      <h1 id="qz-title">Quizzes</h1>
      <p className="sb">Test what stuck.</p>
      <div className="gl dense hero"><QuizPanel /></div>
    </section>
  )
}
