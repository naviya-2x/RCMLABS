export type Role = 'admin' | 'librarian';
export type User = { id:string; name:string; email:string; role:Role };
export type Book = { id:string; book_code:string; isbn?:string; title:string; publisher_name?:string; category_name?:string; authors?:string; cover_image?:string; description?:string; total_copies:number; available_copies:number; shelf_location?:string; status:string; copies?:Copy[] };
export type Copy = { id:string; barcode:string; copy_number:string; status:string; due_date?:string; borrower_name?:string };
export type Member = { id:string; member_code:string; full_name:string; email?:string; phone?:string; membership_type:string; membership_expiry_date:string; status:string; current_loans:number; outstanding_fines:number };
export type Loan = { id:string; member_code:string; full_name?:string; member_name:string; title:string; book_code:string; barcode:string; issue_date:string; due_date:string; status:string; renewal_count:number };
export type Fine = { id:string; member_code:string; member_name:string; type:string; amount:number; paid_amount:number; outstanding:number; status:string; assessed_at:string };
export type ApiResult<T> = { data:T; meta?:{page:number;limit:number;total:number;pages:number} };

export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(path, { ...options, credentials:'include', headers:{'Content-Type':'application/json', ...(options.headers||{})} });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'Something went wrong.');
  return payload as T;
}
export const get = <T,>(path:string) => api<ApiResult<T>>(path);
export const post = <T,>(path:string, body:unknown) => api<ApiResult<T>>(path,{method:'POST',body:JSON.stringify(body)});
export const put = <T,>(path:string, body:unknown) => api<ApiResult<T>>(path,{method:'PUT',body:JSON.stringify(body)});
export const patch = <T,>(path:string, body:unknown) => api<ApiResult<T>>(path,{method:'PATCH',body:JSON.stringify(body)});
export const remove = <T,>(path:string) => api<ApiResult<T>>(path,{method:'DELETE'});
