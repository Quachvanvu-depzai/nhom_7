/* Cấu hình các bảng quản trị. Mỗi field: name (camelCase), label, type, req, options, src, full.
   Cờ của bảng: adminOnly (chỉ ADMIN thấy), roRole (chủ tòa chỉ xem), grouped (nhóm Tòa nhà → Phòng), buildingFilter. */
(function (w) {
  const S = (url, id, label) => ({ url, id, label });
  const OPT = (n) => S('/api/admin/options/' + n, 'id', 'label');
  const SRC = {
    rooms: OPT('rooms'), tenants: OPT('tenants'), managers: OPT('managers'), contracts: OPT('contracts'), buildings: OPT('buildings'), invoices: OPT('invoices'),
    roles: S('/api/admin/roles?size=100', 'roleId', 'roleName'),
    roomTypes: S('/api/admin/room-types?size=100', 'typeId', 'typeName'),
    services: S('/api/admin/services?size=100', 'serviceId', 'serviceName'),
  };
  const opts = (pairs) => pairs.map(([v, t]) => ({ v, t }));
  const ST = {
    invoice: opts([['unpaid', 'Chưa thanh toán'], ['partial', 'Thanh toán một phần'], ['paid', 'Đã thanh toán'], ['cancelled', 'Đã hủy']]),
    contract: opts([['pending', 'Chờ hiệu lực'], ['active', 'Đang hiệu lực'], ['ended', 'Đã kết thúc'], ['cancelled', 'Đã hủy']]),
    ticket: opts([['open', 'Mới'], ['in_progress', 'Đang xử lý'], ['done', 'Hoàn thành'], ['cancelled', 'Đã hủy']]),
    req: opts([['new', 'Mới'], ['processing', 'Đang xử lý'], ['done', 'Xong']]),
    viewing: opts([['new', 'Mới'], ['contacted', 'Đã liên hệ'], ['done', 'Xong'], ['cancelled', 'Hủy']]),
    broker: opts([['new', 'Mới'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']]),
    user: opts([['active', 'Hoạt động'], ['locked', 'Khóa']]),
  };
  const CAT = opts([['hygiene', 'Vệ sinh'], ['maintenance', 'Bảo trì'], ['electric_water', 'Điện nước'], ['security', 'An ninh'], ['other', 'Khác']]);
  const money = (v) => (v === null || v === undefined ? '' : UI.vnd(v));
  const yes = (v) => (v ? '✔' : '—');
  const VEH = { motorbike: 'Xe máy', car: 'Ô tô', bicycle: 'Xe đạp' };

  w.ADMIN_SRC = SRC;
  w.ADMIN_STATUS = ST;
  w.ADMIN_RES = [
    { group: 'Tổng quan', key: 'dashboard', label: '📊 Tổng quan', special: 'dashboard' },

    { group: 'Quản lý hệ thống', key: 'owners', label: '🏢 Chủ tòa nhà', path: 'owners', adminOnly: true, readOnly: true, id: 'userId',
      cols: [['fullName', 'Chủ tòa'], ['phone', 'SĐT'], ['email', 'Email'], ['buildingCount', 'Số tòa'], ['roomCount', 'Số phòng'], ['tenantCount', 'Người thuê'], ['activeContracts', 'HĐ hiệu lực'], ['status', 'Trạng thái']],
      rowActions: 'owner' },
    { key: 'users', label: '🔐 Tài khoản người dùng', path: 'users', adminOnly: true, id: 'userId', status: ST.user, statusKey: 'status',
      cols: [['username', 'Tên đăng nhập'], ['fullName', 'Họ tên'], ['email', 'Email'], ['phone', 'SĐT'], ['roleName', 'Vai trò'], ['buildingCount', 'Số tòa'], ['status', 'Trạng thái']],
      fields: [{ name: 'roleId', label: 'Vai trò', type: 'ref', src: 'roles', req: 1 }, { name: 'username', label: 'Tên đăng nhập', req: 1 }, { name: 'fullName', label: 'Họ tên', req: 1 }, { name: 'email', label: 'Email' }, { name: 'phone', label: 'SĐT' },
        { name: 'status', label: 'Trạng thái', type: 'select', options: ST.user }, { name: 'password', label: 'Mật khẩu (bắt buộc khi tạo; khi sửa để trống = giữ nguyên)', type: 'password', full: 1 },
        { section: 'Thông tin pháp lý' }, { name: 'idNumber', label: 'CCCD/CMND' }, { name: 'birthDate', label: 'Ngày sinh', type: 'date' }, { name: 'idIssueDate', label: 'Ngày cấp', type: 'date' }, { name: 'idIssuePlace', label: 'Nơi cấp' },
        { name: 'address', label: 'Địa chỉ thường trú', full: 1 }, { name: 'bankName', label: 'Ngân hàng' }, { name: 'bankAccount', label: 'Số tài khoản' }] },

    { group: 'Vận hành', key: 'buildings', label: '🏠 Tòa nhà', path: 'buildings', id: 'buildingId',
      cols: [['name', 'Tòa nhà'], ['fullAddr', 'Địa chỉ', (v, r) => [r.address, r.wardName, r.districtName, r.provinceName].filter(Boolean).join(', ')], ['managerName', 'Chủ tòa', null, 'adminOnly'], ['roomCount', 'Số phòng'], ['tenantCount', 'Người thuê']],
      fields: [{ name: 'managerId', label: 'Chủ tòa nhà', type: 'ref', src: 'managers', req: 1, adminOnly: 1 }, { name: 'name', label: 'Tên tòa nhà', req: 1 },
        { name: 'address', label: 'Số nhà, tên đường', req: 1, full: 1 }, { name: '_loc', type: 'location', label: 'Địa chỉ hành chính', full: 1 },
        { name: 'latitude', label: 'Vĩ độ (để gợi ý khu vực gần bạn)', type: 'number' }, { name: 'longitude', label: 'Kinh độ', type: 'number' },
        { name: 'contactName', label: 'Người liên hệ' }, { name: 'contactPhone', label: 'SĐT liên hệ' },
        { name: 'imageUrls', type: 'images', label: 'Ảnh tòa nhà (ảnh đầu tiên là ảnh bìa)', full: 1, from: 'images' }, { name: 'description', label: 'Mô tả', type: 'textarea', full: 1 }] },
    { key: 'rooms', label: '🛏️ Phòng', special: 'rooms' },
    { key: 'tenants', label: '👥 Người thuê', path: 'tenants', id: 'tenantId', grouped: true, buildingFilter: true,
      cols: [['fullName', 'Họ tên'], ['phone', 'SĐT'], ['idNumber', 'CCCD'], ['activeContracts', 'HĐ'], ['vehicleCount', 'Số xe']],
      fields: [{ name: 'roomId', label: 'Phòng đang thuê', type: 'ref', src: 'rooms', req: 1, full: 1 }, { name: 'fullName', label: 'Họ và tên', req: 1 }, { name: 'phone', label: 'Số điện thoại', req: 1 }, { name: 'email', label: 'Email' },
        { name: 'gender', label: 'Giới tính', type: 'select', options: opts([['Nam', 'Nam'], ['Nữ', 'Nữ'], ['Khác', 'Khác']]) }, { name: 'birthDate', label: 'Ngày sinh', type: 'date' },
        { name: 'idNumber', label: 'CCCD/CMND' }, { name: 'idIssueDate', label: 'Ngày cấp', type: 'date' }, { name: 'idIssuePlace', label: 'Nơi cấp' }, { name: 'permanentAddress', label: 'Địa chỉ thường trú', full: 1 }] },
    { key: 'vehicles', label: '🏍️ Phương tiện', path: 'vehicles', id: 'vehicleId', grouped: true, buildingFilter: true,
      cols: [['licensePlate', 'Biển số'], ['vehicleType', 'Loại xe', (v) => VEH[v] || v], ['brandColor', 'Hãng / màu'], ['tenantName', 'Chủ xe']],
      fields: [{ name: 'tenantId', label: 'Chủ xe (người thuê)', type: 'ref', src: 'tenants', req: 1, full: 1 }, { name: 'licensePlate', label: 'Biển số', req: 1 }, { name: 'vehicleType', label: 'Loại xe', type: 'select', options: opts(Object.entries(VEH)) }, { name: 'brandColor', label: 'Hãng xe / màu sắc' }] },
    { key: 'contracts', label: '📄 Hợp đồng', path: 'contracts', id: 'contractId', grouped: true, buildingFilter: true, status: ST.contract, statusKey: 'status', special: 'contracts',
      cols: [['contractCode', 'Số HĐ'], ['tenantName', 'Người thuê'], ['startDate', 'Từ ngày'], ['endDate', 'Đến ngày'], ['monthlyRent', 'Tiền thuê', money], ['status', 'Trạng thái']],
      fields: [{ section: 'Các bên & phòng' }, { name: 'roomId', label: 'Phòng cho thuê', type: 'ref', src: 'rooms', req: 1 }, { name: 'tenantId', label: 'Bên thuê (người thuê)', type: 'ref', src: 'tenants', req: 1 },
        { section: 'Thời hạn & giá' }, { name: 'startDate', label: 'Ngày bắt đầu', type: 'date', req: 1 }, { name: 'endDate', label: 'Ngày kết thúc', type: 'date', req: 1 },
        { name: 'monthlyRent', label: 'Tiền thuê/tháng (trống = giá phòng)', type: 'number' }, { name: 'depositAmount', label: 'Tiền đặt cọc', type: 'number' },
        { name: 'paymentDay', label: 'Thanh toán trước ngày (1-31) hằng tháng', type: 'number' }, { name: 'paymentMethod', label: 'Hình thức thanh toán', type: 'select', options: opts([['Tiền mặt', 'Tiền mặt'], ['Chuyển khoản', 'Chuyển khoản'], ['Tiền mặt hoặc chuyển khoản', 'Tiền mặt hoặc chuyển khoản']]) },
        { name: 'lateFeePercent', label: 'Phạt trả chậm (%/ngày... nhập số %)', type: 'number' }, { name: 'noticeDays', label: 'Báo trước khi chấm dứt (ngày)', type: 'number' },
        { name: 'electricPrice', label: 'Giá điện (đ/kWh, trống = theo bảng dịch vụ)', type: 'number' }, { name: 'waterPrice', label: 'Giá nước (đ/m³, trống = theo bảng dịch vụ)', type: 'number' },
        { name: 'serviceNote', label: 'Ghi chú dịch vụ (internet, rác, giữ xe…)', full: 1 },
        { section: 'Ký kết' }, { name: 'signDate', label: 'Ngày ký', type: 'date' }, { name: 'signPlace', label: 'Nơi ký' },
        { name: 'stayType', label: 'Hình thức', type: 'select', options: opts([['long_term', 'Dài hạn'], ['short_term', 'Ngắn hạn']]) }, { name: 'bookingSource', label: 'Nguồn đặt', type: 'select', options: opts([['direct', 'Trực tiếp'], ['airbnb', 'Airbnb'], ['booking', 'Booking'], ['agent', 'Môi giới']]) },
        { name: 'status', label: 'Trạng thái', type: 'select', options: ST.contract },
        { section: 'Tài sản & điều khoản' }, { name: 'assetsText', label: 'Tài sản bàn giao – mỗi dòng: Tên | Số lượng | Tình trạng', type: 'textarea', full: 1, rows: 5 },
        { name: 'extraTerms', label: 'Điều khoản bổ sung (nếu có)', type: 'textarea', full: 1, rows: 4 }, { name: 'note', label: 'Ghi chú nội bộ', full: 1 }] },
    { key: 'tickets', label: '🛠️ Sự cố / yêu cầu', path: 'tickets', id: 'ticketId', grouped: true, buildingFilter: true, status: ST.ticket, statusKey: 'status',
      cols: [['title', 'Tiêu đề'], ['tenantName', 'Người gửi'], ['category', 'Loại', (v) => (CAT.find((o) => o.v === v) || {}).t || v], ['status', 'Trạng thái'], ['createdAt', 'Tạo lúc']],
      fields: [{ name: 'roomId', label: 'Phòng', type: 'ref', src: 'rooms', req: 1 }, { name: 'tenantId', label: 'Người thuê', type: 'ref', src: 'tenants', req: 1 }, { name: 'category', label: 'Loại', type: 'select', req: 1, options: CAT },
        { name: 'status', label: 'Trạng thái', type: 'select', options: ST.ticket }, { name: 'title', label: 'Tiêu đề', req: 1, full: 1 }, { name: 'description', label: 'Mô tả', type: 'textarea', full: 1 }] },
    { key: 'viewing-requests', label: '👀 Đặt lịch xem phòng', path: 'viewing-requests', id: 'viewingId', grouped: true, buildingFilter: true, status: ST.viewing, statusKey: 'status', noCreate: true,
      cols: [['fullName', 'Khách'], ['phone', 'SĐT'], ['preferredTime', 'Thời gian'], ['status', 'Trạng thái'], ['createdAt', 'Gửi lúc']],
      fields: [{ name: 'status', label: 'Trạng thái', type: 'select', options: ST.viewing }] },

    { group: 'Thu tiền', key: 'meter-readings', label: '⚡ Điện nước', path: 'meter-readings', id: 'readingId', grouped: true, buildingFilter: true,
      cols: [['billingMonth', 'Tháng'], ['oldElectric', 'Điện cũ'], ['newElectric', 'Điện mới'], ['oldWater', 'Nước cũ'], ['newWater', 'Nước mới']],
      fields: [{ name: 'roomId', label: 'Phòng', type: 'ref', src: 'rooms', req: 1 }, { name: 'billingMonth', label: 'Tháng', type: 'month', req: 1 }, { name: 'oldElectric', label: 'Số điện cũ (trống = lấy tháng trước)', type: 'number' }, { name: 'newElectric', label: 'Số điện mới', type: 'number' }, { name: 'oldWater', label: 'Số nước cũ', type: 'number' }, { name: 'newWater', label: 'Số nước mới', type: 'number' }] },
    { key: 'invoices', label: '💰 Hóa đơn', path: 'invoices', id: 'invoiceId', grouped: true, buildingFilter: true, status: ST.invoice, statusKey: 'status', special: 'invoices',
      cols: [['invoiceCode', 'Mã'], ['billingMonth', 'Tháng'], ['tenantName', 'Người thuê'], ['totalAmount', 'Tổng', money], ['dueDate', 'Hạn'], ['status', 'Trạng thái']],
      fields: [{ name: 'contractId', label: 'Hợp đồng', type: 'ref', src: 'contracts', req: 1, full: 1 }, { name: 'billingMonth', label: 'Tháng', type: 'month', req: 1 }, { name: 'dueDate', label: 'Hạn thanh toán', type: 'date', req: 1 }, { name: 'status', label: 'Trạng thái', type: 'select', options: ST.invoice }, { name: 'note', label: 'Ghi chú', full: 1 }] },
    { key: 'payments', label: '💳 Thanh toán', path: 'payments', id: 'paymentId', grouped: true, buildingFilter: true,
      cols: [['invoiceCode', 'Hóa đơn'], ['amountPaid', 'Số tiền', money], ['method', 'Hình thức'], ['paidAt', 'Lúc']],
      fields: [{ name: 'invoiceId', label: 'Hóa đơn', type: 'ref', src: 'invoices', req: 1, full: 1 }, { name: 'amountPaid', label: 'Số tiền', type: 'number', req: 1 }, { name: 'method', label: 'Hình thức', type: 'select', options: opts([['cash', 'Tiền mặt'], ['bank_transfer', 'Chuyển khoản'], ['momo', 'MoMo'], ['other', 'Khác']]) }, { name: 'note', label: 'Ghi chú', full: 1 }] },

    { group: 'Website (Admin)', key: 'promotions', label: '🎁 Khuyến mãi & % giảm giá', path: 'promotions', id: 'promotionId', adminOnly: true, special: 'promotions',
      cols: [['title', 'Tiêu đề'], ['promoType', 'Loại'], ['discountPercent', '% giảm', (v) => (v ? v + '%' : '')], ['startAt', 'Bắt đầu'], ['endAt', 'Kết thúc'], ['isRunning', 'Đang chạy', yes], ['roomCount', 'Số phòng']],
      fields: [{ name: 'title', label: 'Tiêu đề', req: 1, full: 1 }, { name: 'promoType', label: 'Loại', type: 'select', options: opts([['program', 'Chương trình'], ['hotdeal', 'HOTDEAL (giá sốc theo phòng)'], ['voucher', 'Voucher'], ['partner', 'Đối tác']]) },
        { name: 'discountPercent', label: 'Phần trăm giảm giá (%)', type: 'number' }, { name: 'discountText', label: 'Chữ nổi bật (trống = tự điền -N%)' },
        { name: 'voucherCode', label: 'Mã voucher' }, { name: 'bannerColor', label: 'Màu banner', type: 'select', options: opts([['green', 'Xanh lá'], ['orange', 'Cam'], ['blue', 'Xanh dương'], ['purple', 'Tím'], ['red', 'Đỏ'], ['yellow', 'Vàng'], ['teal', 'Xanh ngọc'], ['pink', 'Hồng']]) },
        { name: 'startAt', label: 'Bắt đầu', type: 'datetime', req: 1 }, { name: 'endAt', label: 'Kết thúc', type: 'datetime', req: 1 }, { name: 'linkUrl', label: 'Liên kết (vd: /search.html?hotdeal=true)' }, { name: 'sortOrder', label: 'Thứ tự', type: 'number' },
        { name: 'isActive', label: 'Đang bật', type: 'bool' }, { name: 'description', label: 'Mô tả', type: 'textarea', full: 1 }] },
    { key: 'featured', label: '⭐ Mục nổi bật', special: 'featured', adminOnly: true },
    { key: 'settings', label: '⚙️ Hotline, Zalo & cấu hình', special: 'settings', adminOnly: true },
    { key: 'support-requests', label: '🙋 Yêu cầu hỗ trợ', path: 'support-requests', id: 'requestId', adminOnly: true, status: ST.req, statusKey: 'status', noCreate: true,
      cols: [['fullName', 'Họ tên'], ['phone', 'SĐT'], ['requestType', 'Loại'], ['desiredArea', 'Khu vực'], ['budgetMax', 'Ngân sách', money], ['status', 'Trạng thái'], ['createdAt', 'Gửi lúc']],
      fields: [{ name: 'status', label: 'Trạng thái', type: 'select', options: ST.req }, { name: 'note', label: 'Ghi chú', type: 'textarea', full: 1 }] },
    { key: 'broker-applications', label: '🤝 Đơn môi giới', path: 'broker-applications', id: 'applicationId', adminOnly: true, status: ST.broker, statusKey: 'status', noCreate: true,
      cols: [['fullName', 'Họ tên'], ['phone', 'SĐT'], ['workArea', 'Khu vực'], ['status', 'Trạng thái'], ['createdAt', 'Gửi lúc']],
      fields: [{ name: 'status', label: 'Trạng thái', type: 'select', options: ST.broker }] },

    { group: 'Danh mục chung', key: 'room-types', label: 'Loại hình', path: 'room-types', id: 'typeId', roRole: true,
      cols: [['typeName', 'Tên'], ['slug', 'Slug'], ['sortOrder', 'Thứ tự'], ['roomCount', 'Số phòng']],
      fields: [{ name: 'typeName', label: 'Tên loại hình', req: 1 }, { name: 'slug', label: 'Slug (a-z, 0-9, -)', req: 1 }, { name: 'icon', label: 'Icon' }, { name: 'sortOrder', label: 'Thứ tự', type: 'number' }, { name: 'description', label: 'Mô tả', full: 1 }] },
    { key: 'services', label: 'Bảng giá dịch vụ', path: 'services', id: 'serviceId', roRole: true,
      cols: [['serviceName', 'Tên'], ['calcType', 'Cách tính'], ['unit', 'Đơn vị'], ['unitPrice', 'Đơn giá', money], ['isActive', 'Đang dùng', yes]],
      fields: [{ name: 'serviceName', label: 'Tên dịch vụ', req: 1 }, { name: 'calcType', label: 'Cách tính', type: 'select', options: opts([['FIXED', 'Cố định/tháng'], ['RENT', 'Tiền phòng'], ['METER_ELECTRIC', 'Theo số điện'], ['METER_WATER', 'Theo số nước'], ['PER_VEHICLE', 'Theo số xe']]) }, { name: 'unit', label: 'Đơn vị' }, { name: 'unitPrice', label: 'Đơn giá', type: 'number' }, { name: 'isActive', label: 'Đang sử dụng', type: 'bool' }] },
    { key: 'landmarks', label: 'Trường / nơi làm việc', path: 'landmarks', id: 'landmarkId', roRole: true,
      cols: [['name', 'Tên'], ['landmarkType', 'Loại'], ['districtName', 'Quận/huyện'], ['latitude', 'Vĩ độ'], ['longitude', 'Kinh độ']],
      fields: [{ name: 'name', label: 'Tên', req: 1, full: 1 }, { name: 'landmarkType', label: 'Loại', type: 'select', req: 1, options: opts([['school', 'Trường học'], ['work', 'Nơi làm việc']]) }, { name: 'address', label: 'Địa chỉ', full: 1 }, { name: 'latitude', label: 'Vĩ độ', type: 'number', req: 1 }, { name: 'longitude', label: 'Kinh độ', type: 'number', req: 1 }] },
    { key: 'amenities', label: 'Tiện nghi', path: 'amenities', id: 'amenityId', roRole: true,
      cols: [['name', 'Tên'], ['icon', 'Icon']], fields: [{ name: 'name', label: 'Tên', req: 1 }, { name: 'icon', label: 'Icon' }] },
  ];
})(window);
