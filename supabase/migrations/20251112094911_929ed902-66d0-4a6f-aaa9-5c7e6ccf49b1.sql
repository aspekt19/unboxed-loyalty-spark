-- Создаём триггер для автоматического создания дефолтных уровней
CREATE TRIGGER create_tiers_on_program_insert
  AFTER INSERT ON public.loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_tiers_for_program();