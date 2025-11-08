-- Создаём таблицу отзывов
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(voucher_id) -- Один отзыв на один ваучер
);

-- Создаём таблицу ответов мерчантов
CREATE TABLE IF NOT EXISTS public.review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  merchant_address TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(review_id) -- Один ответ на один отзыв
);

-- Включаем RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

-- RLS политики для reviews
CREATE POLICY "Anyone can view reviews"
  ON public.reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Customers can create reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    customer_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid())
    AND voucher_id IN (
      SELECT id FROM public.vouchers 
      WHERE customer_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid())
      AND status = 'used'
    )
  );

CREATE POLICY "Customers can update own reviews"
  ON public.reviews
  FOR UPDATE
  USING (customer_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()));

-- RLS политики для review_responses
CREATE POLICY "Anyone can view responses"
  ON public.review_responses
  FOR SELECT
  USING (true);

CREATE POLICY "Merchants can create responses"
  ON public.review_responses
  FOR INSERT
  WITH CHECK (
    merchant_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid())
    AND review_id IN (
      SELECT id FROM public.reviews 
      WHERE merchant_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Merchants can update own responses"
  ON public.review_responses
  FOR UPDATE
  USING (merchant_address = (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()));

-- Триггеры для updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_review_responses_updated_at
  BEFORE UPDATE ON public.review_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Функция для автоматической верификации отзыва
CREATE OR REPLACE FUNCTION public.verify_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Проверяем, что ваучер действительно использован и принадлежит клиенту
  IF NEW.voucher_id IS NOT NULL THEN
    NEW.is_verified := EXISTS(
      SELECT 1 FROM vouchers
      WHERE id = NEW.voucher_id
      AND customer_address = NEW.customer_address
      AND merchant_address = NEW.merchant_address
      AND status = 'used'
    );
  ELSE
    NEW.is_verified := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер для верификации при создании отзыва
CREATE TRIGGER verify_review_on_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_review();

-- Индексы для производительности
CREATE INDEX idx_reviews_merchant ON public.reviews(merchant_address);
CREATE INDEX idx_reviews_customer ON public.reviews(customer_address);
CREATE INDEX idx_reviews_token ON public.reviews(token_address);
CREATE INDEX idx_review_responses_review ON public.review_responses(review_id);