import { useState, useMemo, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  getDocs,
  writeBatch,
  doc,
  getDocFromServer,
  updateDoc,
  deleteDoc,
  where,
  limit
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from "firebase/auth";
import { GoogleGenAI } from "@google/genai";
import { db, auth } from "./firebase";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  CreditCard,
  Calendar,
  Filter,
  ArrowUpRight,
  Search,
  Sun,
  Moon,
  Upload,
  Download,
  Trash2,
  Edit2,
  Sparkles,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { rawData, type Transaction } from "./data/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function App() {
  const [rawData, setRawData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 필터 상태
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd")
  });
  
  const [isDark, setIsDark] = useState(false);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: "success" | "error" } | null>(null);
  
  // AI 요약 상태
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 0. Auth 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // 관리자 여부 확인 (예: 특정 이메일)
      setIsAdmin(currentUser?.email === "kim1388218@gmail.com");
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setNotification({ message: "로그인되었습니다.", type: "success" });
    } catch (error) {
      console.error("로그인 오류:", error);
      setNotification({ message: "로그인에 실패했습니다.", type: "error" });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setNotification({ message: "로그아웃되었습니다.", type: "success" });
    } catch (error) {
      console.error("로그아웃 오류:", error);
    }
  };

  // 0. Firestore 연결 상태 확인 (Connection Test)
  // 앱 부팅 시 서버로부터 직접 데이터를 요청하여 연결 상태를 검증합니다.
  useEffect(() => {
    const testConnection = async () => {
      try {
        // 테스트용 문서 참조 (실제 존재 여부와 상관없이 서버 통신 시도)
        await getDocFromServer(doc(db, 'sales_data', 'connection_test'));
        setDbStatus("connected");
        console.log("Firestore 연결 성공!");
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          setDbStatus("error");
          console.error("Firestore 연결 실패: 클라이언트가 오프라인이거나 설정이 잘못되었습니다.");
        } else {
          // 문서가 없는 경우는 연결 성공으로 간주 (서버와 통신은 되었으므로)
          setDbStatus("connected");
        }
      }
    };
    testConnection();
  }, []);

  // 1. 데이터 시딩 (Seeding) 로직
  // Firestore에 데이터가 없을 경우 mockData를 업로드합니다.
  useEffect(() => {
    // 팁: 인증된 사용자가 있을 때만 시딩을 진행하여 보안 규칙을 준수합니다.
    if (!user) return;

    const seedData = async () => {
      try {
        // 팁: 전체 컬렉션이 아닌 사용자의 데이터만 확인하여 권한 오류를 방지합니다.
        const q = query(collection(db, "sales_data"), where("uid", "==", user.uid), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          console.log("데이터가 비어있습니다. 시딩을 시작합니다...");
          const { rawData: mockData } = await import("./data/mockData");
          
          const batch = writeBatch(db);
          mockData.forEach((item) => {
            const docRef = doc(collection(db, "sales_data"));
            batch.set(docRef, {
              ...item,
              uid: user.uid // 현재 사용자의 UID 할당
            });
          });
          await batch.commit();
          console.log("데이터 시딩 완료!");
        }
      } catch (error) {
        console.error("시딩 중 오류 발생:", error);
      }
    };
    seedData();
  }, [user]); // user 상태가 변경될 때(로그인 시) 시딩 여부를 확인합니다.

  // 2. 실시간 데이터 구독 (Real-time Subscription)
  // Firestore의 sales_data 컬렉션을 감시하여 변경사항을 즉시 반영합니다.
  useEffect(() => {
    // 팁: 로그인하지 않은 경우 구독을 시작하지 않아 권한 오류를 방지합니다.
    if (!user && !isAdmin) {
      setRawData([]);
      setLoading(false);
      return;
    }

    // 관리자는 전체, 일반 사용자는 본인 데이터만 조회
    let q = query(collection(db, "sales_data"), orderBy("date", "desc"));
    
    if (user && !isAdmin) {
      q = query(collection(db, "sales_data"), where("uid", "==", user.uid), orderBy("date", "desc"));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id, // 문서 ID 포함 (수정/삭제 시 필요)
        ...doc.data()
      })) as any[];
      
      setRawData(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore 구독 오류:", error);
      // 권한 오류 발생 시 (예: 로그아웃 후 이전 쿼리 유지 등) 처리
      if (error.message.includes("permission-denied")) {
        setRawData([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin]); // user와 isAdmin 상태가 변경될 때마다 구독을 갱신합니다.

  // Theme effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // 알림 자동 삭제 타이머
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // 3. CSV 파일 업로드 및 Firestore 저장 로직
  const handleFileUpload = async (event: any) => {
    // 팁: 업로드 전 로그인 여부를 확인하여 보안 규칙 위반을 방지합니다.
    if (!user) {
      setNotification({ message: "데이터를 업로드하려면 로그인이 필요합니다.", type: "error" });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    console.log("파일 선택됨:", file.name);
    setUploading(true);
    const reader = new FileReader();

    // 파일 읽기 오류 처리
    reader.onerror = () => {
      console.error("파일 읽기 오류");
      setUploading(false);
      alert("파일을 읽는 중 오류가 발생했습니다.");
    };

    reader.onload = async (e) => {
      try {
        let text = e.target?.result as string;
        
        // UTF-8 BOM 제거 (있을 경우)
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.substring(1);
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        console.log("총 라인 수 (헤더 포함):", lines.length);

        if (lines.length <= 1) {
          throw new Error("파일에 헤더 외에 데이터가 없습니다.");
        }

        // 구분자 자동 감지 (쉼표, 탭, 세미콜론)
        const header = lines[0];
        let delimiter = ",";
        if (header.includes("\t")) delimiter = "\t";
        else if (header.includes(";")) delimiter = ";";
        
        console.log(`감지된 구분자: "${delimiter}"`);

        // CSV 데이터를 Transaction 객체 배열로 변환
        const newTransactions: Transaction[] = lines.slice(1)
          .map((line, index): Transaction | null => {
            let values: string[] = [];
            
            if (delimiter === "\t" || delimiter === ";") {
              values = line.split(delimiter);
            } else {
              // 쉼표 구분자일 때 따옴표 안의 쉼표 처리 (더 견고한 정규식)
              // 이 정규식은 쉼표로 구분된 필드를 찾되, 따옴표로 묶인 부분은 하나로 취급합니다.
              const matches = [];
              let match;
              const csvRegex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
              // 정규식이 실패할 경우를 대비해 단순 split fallback 준비
              while ((match = csvRegex.exec(line)) !== null) {
                matches.push(match[0]);
              }
              values = matches.length > 0 ? matches : line.split(",");
            }
            
            // 값 정제 함수
            const clean = (val: string) => {
              if (!val) return "";
              let cleaned = val.trim();
              // 앞뒤 따옴표 제거
              if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.substring(1, cleaned.length - 1);
              }
              return cleaned.trim();
            };

            // 최소 데이터 확인 (필드 수가 부족해도 최대한 수용)
            if (values.length < 2) {
              console.warn(`라인 ${index + 2}의 데이터가 너무 적습니다:`, line);
              return null;
            }

            const orderId = clean(values[0]) || `AUTO-${Date.now()}-${index}`;
            const productName = clean(values[1]) || "이름 없는 상품";
            
            // 가격 추출 (숫자, 소수점 외 제거)
            const rawPrice = values[2] ? clean(values[2]) : "0";
            const priceStr = rawPrice.replace(/[^0-9.]/g, "");
            const price = Math.floor(parseFloat(priceStr)) || 0;
            
            const rawDate = values[3] ? clean(values[3]) : "";
            const paymentMethod = values[4] ? clean(values[4]) : "기타";

            // 날짜 형식 정규화 (YYYY-MM-DD)
            let formattedDate = "";
            if (rawDate) {
              // 다양한 구분자(., /, -)를 -로 통일
              let dateStr = rawDate.split(" ")[0].replace(/[\.\/]/g, "-");
              const parts = dateStr.split("-");
              
              if (parts.length === 3) {
                // YYYY-MM-DD
                if (parts[0].length === 4) {
                  formattedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                } 
                // MM-DD-YYYY 또는 DD-MM-YYYY
                else if (parts[2].length === 4) {
                  // 한국식(YYYY-MM-DD)이 아닐 경우, 첫 번째 파트를 월로 가정 (일반적인 CSV 관행)
                  formattedDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
                }
                // YY-MM-DD
                else if (parts[0].length === 2) {
                  formattedDate = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                }
              }
            }

            // 날짜가 없거나 형식이 틀리면 오늘 날짜 사용
            if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              formattedDate = new Date().toISOString().split("T")[0];
            }

            return {
              orderId,
              productName,
              price,
              date: formattedDate,
              paymentMethod,
              uid: user.uid
            };
          })
          .filter((item): item is Transaction => item !== null);

        console.log("최종 변환된 유효 데이터 수:", newTransactions.length);
        if (newTransactions.length > 0) {
          console.log("첫 번째 데이터 샘플:", newTransactions[0]);
        }

        if (newTransactions.length === 0) {
          throw new Error("업로드할 유효한 데이터가 없습니다.");
        }

        // Firestore에 대량 업로드 (Batch 사용 - 500개 제한 대응)
        // Firestore의 writeBatch는 한 번에 최대 500개의 작업만 처리할 수 있습니다.
        const CHUNK_SIZE = 500;
        for (let i = 0; i < newTransactions.length; i += CHUNK_SIZE) {
          const chunk = newTransactions.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          
          chunk.forEach((item) => {
            const docRef = doc(collection(db, "sales_data"));
            batch.set(docRef, item); // item에 이미 uid가 포함됨
          });
          
          await batch.commit();
          console.log(`${Math.min(i + CHUNK_SIZE, newTransactions.length)}개 데이터 업로드 중...`);
        }
        
        console.log("Firestore 모든 배치 커밋 완료");
        setNotification({ 
          message: `${newTransactions.length}개의 데이터가 성공적으로 업로드되었습니다.`, 
          type: "success" 
        });
      } catch (error) {
        console.error("파일 업로드 중 오류 발생:", error);
        setNotification({ 
          message: `오류: ${error instanceof Error ? error.message : "파일 형식이 올바르지 않거나 업로드 중 오류가 발생했습니다."}`, 
          type: "error" 
        });
      } finally {
        setUploading(false);
        // 입력 필드 초기화
        if (event.target) event.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  // 4. Gemini AI 요약 및 예측 생성
  const generateAiSummary = async () => {
    if (filteredData.length === 0) return;
    
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // 데이터 요약 준비
      const dataSummary = filteredData.slice(0, 50).map(d => 
        `${d.date}: ${d.productName} (${d.price}원)`
      ).join("\n");

      const prompt = `
        다음은 최근 판매 데이터입니다:
        ${dataSummary}
        
        1. 현재 비즈니스 상황을 2문장으로 요약해줘.
        2. 과거 트렌드를 분석하여 다음 달 예상 매출액을 예측하고 그 이유를 1문장으로 설명해줘.
        한국어로 답변해줘.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiSummary(response.text || "분석 결과를 생성할 수 없습니다.");
    } catch (error) {
      console.error("AI 분석 오류:", error);
      setAiSummary("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 5. 데이터 내보내기 (Export to CSV)
  const exportToCsv = () => {
    if (filteredData.length === 0) return;
    
    const headers = ["주문번호", "상품명", "가격(원)", "날짜", "결제방식"];
    const rows = filteredData.map(d => [
      d.orderId,
      d.productName,
      d.price,
      d.date,
      d.paymentMethod
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6. 데이터 삭제
  const handleDelete = async (orderId: string) => {
    if (!window.confirm("정말 이 데이터를 삭제하시겠습니까?")) return;
    
    try {
      // 팁: 전체 조회가 아닌 본인의 데이터(또는 관리자 권한) 내에서만 검색하여 권한 오류를 방지합니다.
      let q = query(collection(db, "sales_data"), where("orderId", "==", orderId));
      if (user && !isAdmin) {
        q = query(collection(db, "sales_data"), where("orderId", "==", orderId), where("uid", "==", user.uid));
      }
      
      const snapshot = await getDocs(q);
      const docToDelete = snapshot.docs[0];
      
      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        setNotification({ message: "데이터가 삭제되었습니다.", type: "success" });
      }
    } catch (error) {
      console.error("삭제 오류:", error);
      setNotification({ message: "삭제에 실패했습니다.", type: "error" });
    }
  };

  // 7. 데이터 수정
  const handleEdit = async (orderId: string, currentPrice: number) => {
    const newPriceStr = window.prompt("새로운 가격을 입력하세요:", currentPrice.toString());
    if (newPriceStr === null) return;
    
    const newPrice = parseInt(newPriceStr, 10);
    if (isNaN(newPrice)) {
      alert("유효한 숫자를 입력해주세요.");
      return;
    }

    try {
      // 팁: 수정 시에도 본인의 데이터인지 확인하는 쿼리를 사용하여 권한 오류를 방지합니다.
      let q = query(collection(db, "sales_data"), where("orderId", "==", orderId));
      if (user && !isAdmin) {
        q = query(collection(db, "sales_data"), where("orderId", "==", orderId), where("uid", "==", user.uid));
      }
      
      const snapshot = await getDocs(q);
      const docToUpdate = snapshot.docs[0];
      
      if (docToUpdate) {
        await updateDoc(docToUpdate.ref, { price: newPrice });
        setNotification({ message: "가격이 수정되었습니다.", type: "success" });
      }
    } catch (error) {
      console.error("수정 오류:", error);
      setNotification({ message: "수정에 실패했습니다.", type: "error" });
    }
  };

  // Dynamic Chart Colors
  const chartColors = isDark 
    ? ["#f5f5f5", "#d1d1d1", "#8e9299", "#4a4a4a", "#262626"]
    : ["#141414", "#4a4a4a", "#8e9299", "#d1d1d1", "#f5f5f5"];

  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const textColor = isDark ? "#888" : "#666";

  // Filtered Data
  const filteredData = useMemo(() => {
    return rawData.filter((item) => {
      const matchesProduct = filterProduct === "all" || item.productName === filterProduct;
      const matchesPayment = filterPayment === "all" || item.paymentMethod === filterPayment;
      const matchesSearch = item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.orderId.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 날짜 범위 필터
      const itemDate = parseISO(item.date);
      const matchesDate = isWithinInterval(itemDate, {
        start: startOfDay(parseISO(dateRange.start)),
        end: endOfDay(parseISO(dateRange.end))
      });

      return matchesProduct && matchesPayment && matchesSearch && matchesDate;
    });
  }, [filterProduct, filterPayment, searchQuery, rawData, dateRange]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalSales = filteredData.reduce((acc, curr) => acc + curr.price, 0);
    const totalOrders = new Set(filteredData.map(d => d.orderId)).size;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // MoM (Month over Month) 계산
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthSales = filteredData
      .filter(d => {
        const date = parseISO(d.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((acc, curr) => acc + curr.price, 0);

    const prevMonthSales = rawData
      .filter(d => {
        const date = parseISO(d.date);
        return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
      })
      .reduce((acc, curr) => acc + curr.price, 0);

    const momGrowth = prevMonthSales > 0 
      ? ((currentMonthSales - prevMonthSales) / prevMonthSales) * 100 
      : 0;

    const productCounts: Record<string, number> = {};
    filteredData.forEach(d => {
      productCounts[d.productName] = (productCounts[d.productName] || 0) + 1;
    });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "없음";

    return { totalSales, totalOrders, avgOrderValue, topProduct, momGrowth };
  }, [filteredData, rawData]);

  // Chart Data: Sales Trend
  const trendData = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredData.forEach(d => {
      daily[d.date] = (daily[d.date] || 0) + d.price;
    });
    return Object.entries(daily)
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // Chart Data: Sales by Product
  const productData = useMemo(() => {
    const products: Record<string, number> = {};
    filteredData.forEach(d => {
      products[d.productName] = (products[d.productName] || 0) + d.price;
    });
    return Object.entries(products)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData]);

  // Chart Data: Payment Methods
  const paymentMapping: Record<string, string> = {
    "Credit Card": "신용카드",
    "Debit Card": "체크카드",
    "eWallet": "전자지갑",
    "Cash": "현금"
  };

  const paymentData = useMemo(() => {
    const methods: Record<string, number> = {};
    filteredData.forEach(d => {
      const translated = paymentMapping[d.paymentMethod] || d.paymentMethod;
      methods[translated] = (methods[translated] || 0) + 1;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const uniqueProducts = useMemo(() => Array.from(new Set(rawData.map(d => d.productName))), [rawData]);
  const uniquePayments = useMemo(() => Array.from(new Set(rawData.map(d => d.paymentMethod))), [rawData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-sm uppercase tracking-widest animate-pulse">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground transition-colors duration-300">
      {/* 알림 메시지 표시 */}
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300",
          notification.type === "success" ? "bg-green-500 text-white border-green-600" : "bg-red-500 text-white border-red-600"
        )}>
          <div className="flex items-center gap-3">
            <div className="font-medium">{notification.message}</div>
            <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Sidebar / Navigation Rail */}
      <div className="fixed left-0 top-0 h-full w-16 bg-primary flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col gap-6 mt-12 flex-1">
          <TrendingUp className="w-6 h-6 text-primary-foreground/40 hover:text-primary-foreground cursor-pointer transition-colors" title="트렌드" />
          <Package className="w-6 h-6 text-primary-foreground/40 hover:text-primary-foreground cursor-pointer transition-colors" title="상품" />
          <CreditCard className="w-6 h-6 text-primary-foreground/40 hover:text-primary-foreground cursor-pointer transition-colors" title="결제" />
          <Calendar className="w-6 h-6 text-primary-foreground/40 hover:text-primary-foreground cursor-pointer transition-colors" title="일정" />
        </div>
        
        {/* Auth Buttons */}
        <div className="flex flex-col gap-4 mb-4">
          {user ? (
            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground/40 hover:text-primary-foreground hover:bg-white/10 transition-all"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground/40 hover:text-primary-foreground hover:bg-white/10 transition-all"
              title="로그인"
            >
              <LogIn className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground/40 hover:text-primary-foreground hover:bg-white/10 transition-all mb-4"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Content */}
      <main className="pl-16 p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">판매 인텔리전스</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
              실시간 성과 모니터링 • 2025년 3분기
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* 날짜 범위 필터 */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input 
                type="date" 
                className="bg-transparent border-none text-xs focus:outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="text-muted-foreground text-xs">~</span>
              <input 
                type="date" 
                className="bg-transparent border-none text-xs focus:outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>

            {/* 데이터 내보내기 버튼 */}
            <Button 
              variant="outline" 
              className="bg-card border-border flex items-center gap-2"
              onClick={exportToCsv}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV 내보내기</span>
            </Button>

            {/* 파일 업로드 버튼 */}
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={uploading}
              />
              <Button 
                variant="outline" 
                className="bg-card border-border flex items-center gap-2 p-0"
              >
                <label htmlFor="csv-upload" className="cursor-pointer w-full h-full flex items-center justify-center px-4">
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? "업로드 중..." : "CSV 업로드"}
                </label>
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="주문 검색..."
                className="pl-10 pr-4 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="상품 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상품</SelectItem>
                {uniqueProducts.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="결제 방식" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 결제 방식</SelectItem>
                {uniquePayments.map(p => (
                  <SelectItem key={p} value={p}>{paymentMapping[p] || p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* AI Insight Section */}
        <Card className="border-primary/20 bg-primary/5 mb-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Sparkles className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI 비즈니스 인사이트
            </CardTitle>
            <CardDescription>Gemini AI가 분석한 현재 데이터 요약</CardDescription>
          </CardHeader>
          <CardContent>
            {aiSummary ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {aiSummary}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                {isAiLoading ? "AI가 데이터를 분석하고 있습니다..." : "버튼을 눌러 분석을 시작하세요."}
              </div>
            )}
            <Button 
              size="sm" 
              className="mt-4" 
              onClick={generateAiSummary}
              disabled={isAiLoading || filteredData.length === 0}
            >
              {isAiLoading ? "분석 중..." : "인사이트 생성하기"}
            </Button>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="border-border shadow-sm bg-card overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-muted rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "border-none",
                    stats.momGrowth >= 0 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {stats.momGrowth >= 0 ? "+" : ""}{stats.momGrowth.toFixed(1)}% MoM
                </Badge>
              </div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">총 매출액</p>
              <h3 className="text-3xl font-bold tracking-tight">
                ₩{stats.totalSales.toLocaleString()}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-card overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-muted rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none">
                  활성
                </Badge>
              </div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">총 주문 건수</p>
              <h3 className="text-3xl font-bold tracking-tight">
                {stats.totalOrders.toLocaleString()}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-card overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-muted rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-none">
                  안정적
                </Badge>
              </div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">평균 주문 금액</p>
              <h3 className="text-3xl font-bold tracking-tight">
                ₩{Math.round(stats.avgOrderValue).toLocaleString()}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-card overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-muted rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Filter className="w-5 h-5" />
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-none">
                  베스트셀러
                </Badge>
              </div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">인기 상품</p>
              <h3 className="text-xl font-bold tracking-tight truncate" title={stats.topProduct}>
                {stats.topProduct}
              </h3>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Trend Chart */}
          <Card className="lg:col-span-2 border-border shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
              <div>
                <CardTitle className="text-xl font-bold">매출 트렌드</CardTitle>
                <CardDescription className="font-mono text-xs uppercase">기간별 일일 매출 성과</CardDescription>
              </div>
              <Tabs value={chartType} onValueChange={(v) => setChartType(v as "line" | "bar")} className="w-[120px]">
                <TabsList className="grid w-full grid-cols-2 bg-muted">
                  <TabsTrigger value="line" className="text-xs">라인</TabsTrigger>
                  <TabsTrigger value="bar" className="text-xs">바</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "line" ? (
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: textColor }}
                        tickFormatter={(val) => format(parseISO(val), "MM/dd")}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: textColor }}
                        tickFormatter={(val) => `₩${val/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: isDark ? "#262626" : "#141414", border: "none", borderRadius: "8px", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                        labelStyle={{ color: "#888", marginBottom: "4px" }}
                        formatter={(val: number) => [`₩${val.toLocaleString()}`, "매출"]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="sales" 
                        stroke={isDark ? "#fff" : "#141414"} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: isDark ? "#fff" : "#141414", strokeWidth: 2, stroke: isDark ? "#141414" : "#fff" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: textColor }}
                        tickFormatter={(val) => format(parseISO(val), "MM/dd")}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: textColor }}
                        tickFormatter={(val) => `₩${val/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: isDark ? "#262626" : "#141414", border: "none", borderRadius: "8px", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                        labelStyle={{ color: "#888", marginBottom: "4px" }}
                        formatter={(val: number) => [`₩${val.toLocaleString()}`, "매출"]}
                      />
                      <Bar 
                        dataKey="sales" 
                        fill={isDark ? "#fff" : "#141414"} 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Distribution */}
          <Card className="border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold">결제 수단 분포</CardTitle>
              <CardDescription className="font-mono text-xs uppercase">거래 방식별 비중</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: isDark ? "#262626" : "#141414", border: "none", borderRadius: "8px", color: "#fff" }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Top Products & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Products Bar Chart */}
          <Card className="border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold">인기 상품 순위</CardTitle>
              <CardDescription className="font-mono text-xs uppercase">상품별 매출 기여도</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: isDark ? "#fff" : "#141414", fontWeight: 500 }}
                      width={120}
                    />
                    <Tooltip 
                      cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" }}
                      contentStyle={{ backgroundColor: isDark ? "#262626" : "#141414", border: "none", borderRadius: "8px", color: "#fff" }}
                      formatter={(val: number) => [`₩${val.toLocaleString()}`, "매출"]}
                    />
                    <Bar dataKey="value" fill={isDark ? "#fff" : "#141414"} radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders Table */}
          <Card className="lg:col-span-2 border-border shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">최근 거래 내역</CardTitle>
                <CardDescription className="font-mono text-xs uppercase">최신 주문 활동 로그</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest">주문 ID</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest">상품명</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right">가격</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest">날짜</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest">결제방식</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, 50).map((item, idx) => (
                      <TableRow key={`${item.orderId}-${idx}`} className="border-border hover:bg-muted/50 transition-colors group">
                        <TableCell className="font-mono text-xs font-medium">{item.orderId}</TableCell>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell className="text-sm font-mono text-right">₩{item.price.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase font-normal border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                            {paymentMapping[item.paymentMethod] || item.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEdit(item.orderId, item.price)}
                              className="p-1 hover:text-primary transition-colors"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.orderId)}
                              className="p-1 hover:text-destructive transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="pl-16 p-4 border-t border-border bg-card flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              dbStatus === "connected" ? "bg-green-500" : 
              dbStatus === "error" ? "bg-red-500" : "bg-yellow-500"
            )} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {dbStatus === "connected" ? "데이터베이스 연결됨" : 
               dbStatus === "error" ? "연결 오류" : "연결 확인 중..."}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-border" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            전체 {rawData.length}개 중 {filteredData.length}개 표시 중
          </span>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          © 2025 SalesIntel v1.0.4
        </div>
      </footer>
    </div>
  );
}


